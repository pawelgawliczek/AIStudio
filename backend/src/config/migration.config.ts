/**
 * Configuration for database migration safety system
 */

export const migrationConfig = {
  backup: {
    primaryLocation: '/opt/stack/AIStudio/backups',
    temporaryLocation: '/tmp/vibestudio_backups',
    format: 'custom', // pg_dump -Fc
    retention: {
      preMigration: 7, // days
      daily: 30, // days
      manual: 90, // days
      emergency: 365, // days (never auto-delete)
    },
    verification: {
      enabled: true,
      sampleRows: 100,
      minSizeBytes: 1024, // 1KB minimum
    },
  },

  lock: {
    defaultDuration: 60, // minutes
    renewThreshold: 45, // minutes (when to renew)
    maxDuration: 120, // minutes (hard limit)
    source: 'st-70-migration-safety',
  },

  validation: {
    levels: ['schema', 'dataIntegrity', 'health', 'smokeTests'],
    timeout: 600, // seconds
    healthCheckEndpoint: 'http://localhost:3001/api/health',
    retries: 3,
    retryDelay: 5000, // milliseconds
  },

  logging: {
    directory: '/opt/stack/AIStudio/logs/migrations',
    retention: 90, // days
    format: 'json',
  },

  docker: {
    containerName: 'vibe-studio-postgres',
    username: 'postgres',
    database: 'vibestudio',
    execTimeout: 600000, // 10 minutes
  },

  migration: {
    maxDuration: 600000, // 10 minutes per migration
    transactionTimeout: 600000, // 10 minutes
  },

  alerting: {
    enabled: false, // Future: Slack/email integration
    channels: [],
  },
} as const;

export type MigrationConfig = typeof migrationConfig;
