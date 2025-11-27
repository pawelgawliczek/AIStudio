import api from './api';

export interface BackupStatus {
  production: {
    healthy: boolean;
    lastBackupTime: string | null;
    lastBackupFile: string | null;
    hoursSinceLastBackup: number | null;
    backupCount: number;
    totalSizeMB: number;
    alerts: string[];
  };
  overallHealth: boolean;
  lastCheckTime: string;
}

export interface BackupInfo {
  filename: string;
  environment: string;
  timestamp: string;
  size: number;
  sizeMB: number;
  age: string;
  ageHours: number;
  checksum: string | null;
  fullPath: string;
  createdAt: string | null;
}

export interface ListBackupsResponse {
  backups: BackupInfo[];
  total: number;
  byEnvironment: {
    production: number;
    development: number;
    legacy: number;
  };
}

export interface RunBackupResponse {
  success: boolean;
  backupFile: string;
  backupPath: string;
  sizeMB: number;
  duration: number;
  checksum: string;
  environment: string;
  timestamp: string;
  error?: string;
}

export interface RestoreBackupResponse {
  success: boolean;
  restoredFrom: string;
  tablesRestored: number;
  duration: number;
  checksumVerified: boolean;
  warning?: string;
  error?: string;
}

export interface BackupFilters {
  environment?: string;
  limit?: number;
}

export const backupsService = {
  async getStatus(): Promise<BackupStatus> {
    const response = await api.get('/backups/status');
    return response.data;
  },

  async listBackups(filters: BackupFilters = {}): Promise<ListBackupsResponse> {
    const params = new URLSearchParams();
    if (filters.environment) params.append('environment', filters.environment);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/backups?${params.toString()}`);
    return response.data;
  },

  async runBackup(environment: 'production' | 'development' = 'production'): Promise<RunBackupResponse> {
    const response = await api.post('/backups/run', { environment });
    return response.data;
  },

  async restoreBackup(backupFile: string, confirm: boolean): Promise<RestoreBackupResponse> {
    const response = await api.post('/backups/restore', {
      backupFile,
      confirm,
    });
    return response.data;
  },
};
