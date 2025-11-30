/**
 * Unit tests for ValidationService
 */

// Create mock prisma instance that will be used by the service
const mockPrisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn(),
  project: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  story: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  useCase: {
    findMany: jest.fn(),
  },
  workflow: {
    findMany: jest.fn(),
  },
};

// Mock Prisma at module level - must be before import
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock docker exec utility
jest.mock('../../utils/docker-exec.util');

import { ValidationLevel } from '../../types/migration.types';
import { dockerExec } from '../../utils/docker-exec.util';
import { ValidationService } from '../validation.service';

const mockDockerExec = dockerExec as jest.MockedFunction<typeof dockerExec>;

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
    jest.clearAllMocks();

    // Reset default mock implementations
    mockPrisma.$connect.mockResolvedValue(undefined);
    mockPrisma.$disconnect.mockResolvedValue(undefined);
  });

  describe('validateSchema', () => {
    it('should validate schema successfully', async () => {
      // Mock docker exec: 1st call = table count, 8 calls for critical tables, index count, FK count
      mockDockerExec
        .mockResolvedValueOnce({ success: true, stdout: '30', stderr: '', exitCode: 0 }) // table count
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // projects
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // epics
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // stories
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // use_cases
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // test_cases
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // workflows
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // workflow_components
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // workflow_runs
        .mockResolvedValueOnce({ success: true, stdout: '50', stderr: '', exitCode: 0 }) // index count
        .mockResolvedValue({ success: true, stdout: '20', stderr: '', exitCode: 0 }); // FK count

      const result = await validationService.validateSchema();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.SCHEMA);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should fail if tables are missing', async () => {
      mockDockerExec.mockResolvedValue({ success: true, stdout: '0', stderr: '', exitCode: 0 });

      const result = await validationService.validateSchema();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateDataIntegrity', () => {
    it('should validate data integrity successfully', async () => {
      // Mock Prisma methods - all return 0 violations
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);

      const result = await validationService.validateDataIntegrity();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.DATA_INTEGRITY);
    });

    it('should detect data integrity violations', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(5) }]); // violations found

      const result = await validationService.validateDataIntegrity();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateHealth', () => {
    it('should run all health checks successfully', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(1) }]);
      mockPrisma.project.count.mockResolvedValue(10);
      mockPrisma.story.count.mockResolvedValue(50);

      const result = await validationService.validateHealth();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.HEALTH);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should detect unhealthy database', async () => {
      mockPrisma.$connect.mockRejectedValue(new Error('Connection failed'));

      const result = await validationService.validateHealth();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('runSmokeTests', () => {
    it('should run smoke tests successfully', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: '1', name: 'Test' }]);
      mockPrisma.story.findMany.mockResolvedValue([]);
      mockPrisma.useCase.findMany.mockResolvedValue([]);
      mockPrisma.workflow.findMany.mockResolvedValue([]);

      const result = await validationService.runSmokeTests();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.SMOKE_TESTS);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should detect failed smoke tests', async () => {
      mockPrisma.project.findMany.mockRejectedValue(new Error('Query failed'));

      const result = await validationService.runSmokeTests();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateAll', () => {
    it('should run all validation levels successfully', async () => {
      // Mock docker exec: 1st call = table count, 8 calls for critical tables, index count, FK count
      mockDockerExec
        .mockResolvedValueOnce({ success: true, stdout: '30', stderr: '', exitCode: 0 }) // table count
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // projects
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // epics
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // stories
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // use_cases
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // test_cases
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // workflows
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // workflow_components
        .mockResolvedValueOnce({ success: true, stdout: 't', stderr: '', exitCode: 0 }) // workflow_runs
        .mockResolvedValueOnce({ success: true, stdout: '50', stderr: '', exitCode: 0 }) // index count
        .mockResolvedValue({ success: true, stdout: '20', stderr: '', exitCode: 0 }); // FK count

      // Mock Prisma for data integrity, health, and smoke tests
      mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
      mockPrisma.project.count.mockResolvedValue(10);
      mockPrisma.project.findMany.mockResolvedValue([{ id: '1', name: 'Test' }]);
      mockPrisma.story.count.mockResolvedValue(50);
      mockPrisma.story.findMany.mockResolvedValue([]);
      mockPrisma.useCase.findMany.mockResolvedValue([]);
      mockPrisma.workflow.findMany.mockResolvedValue([]);

      const result = await validationService.validateAll();

      expect(result.schema.passed).toBe(true);
      expect(result.dataIntegrity?.passed).toBe(true);
      expect(result.health?.passed).toBe(true);
      expect(result.smokeTests?.passed).toBe(true);
    });

    it('should stop validation if schema fails', async () => {
      mockDockerExec.mockResolvedValue({ success: true, stdout: '0', stderr: '', exitCode: 0 });

      const result = await validationService.validateAll();

      expect(result.schema.passed).toBe(false);
      expect(result.dataIntegrity).toBeUndefined();
      expect(result.health).toBeUndefined();
      expect(result.smokeTests).toBeUndefined();
    });
  });
});
