import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConnectionState {
  state: string;
  count: number;
}

export interface ConnectionDetail {
  pid: number;
  usename: string;
  application_name: string;
  client_addr: string | null;
  state: string;
  query_start: Date | null;
  state_change: Date | null;
  wait_event_type: string | null;
  wait_event: string | null;
}

export interface PoolStats {
  total_connections: number;
  active_connections: number;
  idle_connections: number;
  pool_size: number;
  utilization_percent: number;
  oldest_connection_age_seconds: number | null;
}

export interface DatabaseMetrics {
  timestamp: string;
  // Single-element array for Grafana Infinity datasource compatibility
  pool_stats: PoolStats[];
  // Arrays for charts/tables
  connection_states: ConnectionState[];
  connection_details: ConnectionDetail[];
}

export interface ConnectionHistoryPoint {
  timestamp: string;
  total_connections: number;
  active_connections: number;
  idle_connections: number;
  utilization_percent: number;
}

const HISTORY_KEY = 'db_connection_history';
const MAX_HISTORY_POINTS = 180; // 30 minutes at 10s intervals

@Injectable()
export class DatabaseMetricsService {
  private readonly logger = new Logger(DatabaseMetricsService.name);
  private history: ConnectionHistoryPoint[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async getConnectionMetrics(): Promise<DatabaseMetrics> {
    try {
      // Get connection counts by state
      const connectionStates = await this.prisma.$queryRaw<ConnectionState[]>`
        SELECT state, count(*)::int as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
      `;

      // Get pool utilization
      const poolUtilizationRaw = await this.prisma.$queryRaw<
        Array<{ total: bigint; active: bigint; idle: bigint; pool_size: number }>
      >`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as total,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') as active,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') as idle,
          50 as pool_size
      `;

      const poolUtilizationData = poolUtilizationRaw[0];
      const total = Number(poolUtilizationData.total);
      const active = Number(poolUtilizationData.active);
      const idle = Number(poolUtilizationData.idle);
      const poolSize = poolUtilizationData.pool_size;
      const utilizationPercent = poolSize > 0 ? Math.round((total / poolSize) * 100) : 0;

      // Get connection details
      const connectionDetails = await this.prisma.$queryRaw<ConnectionDetail[]>`
        SELECT
          pid,
          usename,
          application_name,
          client_addr::text,
          state,
          query_start,
          state_change,
          wait_event_type,
          wait_event
        FROM pg_stat_activity
        WHERE datname = current_database()
        ORDER BY state_change DESC
        LIMIT 100
      `;

      // Calculate oldest connection age
      const oldestConnection = await this.prisma.$queryRaw<
        Array<{ oldest_seconds: number | null }>
      >`
        SELECT
          EXTRACT(EPOCH FROM (NOW() - MIN(backend_start)))::int as oldest_seconds
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      const oldestConnectionAge = oldestConnection[0]?.oldest_seconds ?? null;
      const timestamp = new Date().toISOString();

      // Store in history for time series
      this.addToHistory({
        timestamp,
        total_connections: total,
        active_connections: active,
        idle_connections: idle,
        utilization_percent: utilizationPercent,
      });

      return {
        timestamp,
        // Single-element array for Grafana Infinity stat panels
        pool_stats: [
          {
            total_connections: total,
            active_connections: active,
            idle_connections: idle,
            pool_size: poolSize,
            utilization_percent: utilizationPercent,
            oldest_connection_age_seconds: oldestConnectionAge,
          },
        ],
        connection_states: connectionStates,
        connection_details: connectionDetails,
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics', error);
      throw error;
    }
  }

  private addToHistory(point: ConnectionHistoryPoint): void {
    this.history.push(point);
    // Keep only last MAX_HISTORY_POINTS
    while (this.history.length > MAX_HISTORY_POINTS) {
      this.history.shift();
    }
  }

  getConnectionHistory(): ConnectionHistoryPoint[] {
    return [...this.history];
  }
}
