/**
 * Type definitions for database migration safety system
 */

export enum BackupType {
  PRE_MIGRATION = 'premig',
  DAILY = 'daily',
  MANUAL = 'manual',
  EMERGENCY = 'emergency',
}

export enum MigrationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum ValidationLevel {
  SCHEMA = 'schema',
  DATA_INTEGRITY = 'dataIntegrity',
  HEALTH = 'health',
  SMOKE_TESTS = 'smokeTests',
}

export interface Backup {
  filename: string;
  filepath: string;
  type: BackupType;
  size: number;
  created: Date;
  verified: boolean;
  context?: string;
  metadata?: BackupMetadata;
}

export interface BackupMetadata {
  databaseName: string;
  tableCount: number;
  totalRows?: number;
  postgresVersion?: string;
  duration?: number;
}

export interface VerificationResult {
  success: boolean;
  fileExists: boolean;
  fileSizeValid: boolean;
  sampleRestoreSuccess?: boolean;
  rowCountValid?: boolean;
  errors: string[];
}

export interface RestoreResult {
  success: boolean;
  backupFile: string;
  duration: number;
  errors: string[];
  validationPassed: boolean;
}

export interface RestoreOptions {
  force?: boolean;
  skipValidation?: boolean;
  targetDatabase?: string;
}

export interface BackupFilter {
  type?: BackupType;
  minSize?: number;
  maxAge?: number; // days
  verified?: boolean;
}

export interface MigrationOptions {
  dryRun?: boolean;
  environment?: 'development' | 'staging' | 'production';
  storyId?: string;
  skipValidation?: boolean;
  validationLevels?: ValidationLevel[];
}

export interface MigrationResult {
  success: boolean;
  duration: number;
  backupFile?: string;
  migrationsApplied: number;
  validationResults?: ValidationResults;
  errors: string[];
}

export interface ValidationResults {
  schema: ValidationResult;
  dataIntegrity?: ValidationResult;
  health?: ValidationResult;
  smokeTests?: ValidationResult;
}

export interface ValidationResult {
  level: ValidationLevel;
  passed: boolean;
  checks: ValidationCheck[];
  errors: string[];
  duration: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
  details?: any;
}

export interface Lock {
  id: string;
  reason: string;
  durationMinutes: number;
  expiresAt: Date;
  metadata?: any;
}

export interface LockStatus {
  locked: boolean;
  lockId?: string;
  reason?: string;
  expiresAt?: Date;
  remainingMinutes?: number;
  lockedBy?: string;
}

export interface Checkpoint {
  name: string;
  timestamp: Date;
  status: 'success' | 'failure';
  message?: string;
  metadata?: any;
}

export interface DockerExecOptions {
  containerName: string;
  command: string;
  timeout?: number;
}

export interface DockerExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
}
