import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestCaseDto, UpdateTestCaseDto, TestCaseSearchDto } from './dto';
import { TestCasesService } from './test-cases.service';

describe('TestCasesService', () => {
  let service: TestCasesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    useCase: {
      findUnique: jest.fn(),
    },
    testCase: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    testExecution: {
      findMany: jest.fn(),
    },
  };

  const mockProject = {
    id: 'project-id',
    name: 'Test Project',
    description: 'Test description',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUseCase = {
    id: 'use-case-id',
    projectId: 'project-id',
    key: 'UC-TEST-001',
    title: 'Test Use Case',
    area: 'Authentication',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTestCase = {
    id: 'test-case-id',
    projectId: 'project-id',
    useCaseId: 'use-case-id',
    key: 'TC-AUTH-001',
    title: 'Test user login',
    description: 'Verify user can login successfully',
    testLevel: 'unit' as any,
    priority: 'high' as any,
    preconditions: 'User account exists',
    testSteps: '1. Navigate to login\n2. Enter credentials\n3. Click login',
    expectedResults: 'User is logged in',
    testData: null,
    testFilePath: '/tests/auth/login.spec.ts',
    status: 'pending' as any,
    assignedToId: null,
    createdById: 'user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'dev' as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestCasesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TestCasesService>(TestCasesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTestCaseDto = {
      projectId: 'project-id',
      useCaseId: 'use-case-id',
      key: 'TC-AUTH-001',
      title: 'Test user login',
      description: 'Verify user can login successfully',
      testLevel: 'unit' as any,
      priority: 'high' as any,
      preconditions: 'User account exists',
      testSteps: '1. Navigate to login\n2. Enter credentials\n3. Click login',
      expectedResults: 'User is logged in',
      testFilePath: '/tests/auth/login.spec.ts',
    };

    it('should create a new test case', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.testCase.findUnique.mockResolvedValue(null);
      mockPrismaService.testCase.create.mockResolvedValue({
        ...mockTestCase,
        useCase: mockUseCase,
        createdBy: mockUser,
        assignedTo: null,
      });

      const result = await service.create(createDto, 'user-id');

      expect(result).toBeDefined();
      expect(result.key).toBe('TC-AUTH-001');
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-id' },
      });
      expect(mockPrismaService.useCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'use-case-id' },
      });
      expect(mockPrismaService.testCase.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.testCase.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if use case does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.testCase.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if test case key already exists', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(ConflictException);
      expect(mockPrismaService.testCase.create).not.toHaveBeenCalled();
    });

    it('should set default priority to medium if not provided', async () => {
      const dtoWithoutPriority = { ...createDto };
      delete dtoWithoutPriority.priority;

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.testCase.findUnique.mockResolvedValue(null);
      mockPrismaService.testCase.create.mockResolvedValue({
        ...mockTestCase,
        priority: 'medium',
        useCase: mockUseCase,
        createdBy: mockUser,
        assignedTo: null,
      });

      const result = await service.create(dtoWithoutPriority, 'user-id');

      expect(mockPrismaService.testCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'medium',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    const searchDto: TestCaseSearchDto = {
      projectId: 'project-id',
      page: 1,
      limit: 20,
    };

    it('should return paginated test cases', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      const result = await service.findAll(searchDto);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-id' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by useCaseId', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      await service.findAll({ ...searchDto, useCaseId: 'use-case-id' });

      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            useCaseId: 'use-case-id',
          }),
        }),
      );
    });

    it('should filter by testLevel', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      await service.findAll({ ...searchDto, testLevel: 'unit' as any });

      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            testLevel: 'unit',
          }),
        }),
      );
    });

    it('should filter by priority', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      await service.findAll({ ...searchDto, priority: 'high' as any });

      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            priority: 'high',
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      await service.findAll({ ...searchDto, status: 'pending' as any });

      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            status: 'pending',
          }),
        }),
      );
    });

    it('should filter by assignedToId', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      await service.findAll({ ...searchDto, assignedToId: 'user-id' });

      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            assignedToId: 'user-id',
          }),
        }),
      );
    });

    it('should include relations when requested', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([
        {
          ...mockTestCase,
          useCase: mockUseCase,
          createdBy: mockUser,
          assignedTo: null,
        },
      ]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      await service.findAll({ ...searchDto, includeRelations: true });

      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.any(Object),
        }),
      );
    });

    it('should not include relations when not requested', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrismaService.testCase.count.mockResolvedValue(1);

      await service.findAll({ ...searchDto, includeRelations: false });

      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: undefined,
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.testCase.findMany.mockResolvedValue([]);
      mockPrismaService.testCase.count.mockResolvedValue(50);

      const result = await service.findAll({ ...searchDto, page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single test case', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue({
        ...mockTestCase,
        useCase: mockUseCase,
        createdBy: mockUser,
        assignedTo: null,
        executions: [],
      });

      const result = await service.findOne('test-case-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('test-case-id');
      expect(mockPrismaService.testCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-case-id' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if test case not found', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should include relations by default', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue({
        ...mockTestCase,
        useCase: mockUseCase,
        createdBy: mockUser,
        assignedTo: null,
        executions: [],
      });

      await service.findOne('test-case-id');

      expect(mockPrismaService.testCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-case-id' },
        include: expect.any(Object),
      });
    });

    it('should not include relations when requested', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);

      await service.findOne('test-case-id', false);

      expect(mockPrismaService.testCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-case-id' },
        include: undefined,
      });
    });
  });

  describe('update', () => {
    const updateDto: UpdateTestCaseDto = {
      title: 'Updated title',
      description: 'Updated description',
      priority: 'critical' as any,
    };

    it('should update a test case', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrismaService.testCase.update.mockResolvedValue({
        ...mockTestCase,
        ...updateDto,
        useCase: mockUseCase,
        createdBy: mockUser,
        assignedTo: null,
      });

      const result = await service.update('test-case-id', updateDto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Updated title');
      expect(mockPrismaService.testCase.update).toHaveBeenCalledWith({
        where: { id: 'test-case-id' },
        data: updateDto,
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if test case not found', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.testCase.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a test case', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrismaService.testCase.delete.mockResolvedValue(mockTestCase);

      await service.remove('test-case-id');

      expect(mockPrismaService.testCase.delete).toHaveBeenCalledWith({
        where: { id: 'test-case-id' },
      });
    });

    it('should throw NotFoundException if test case not found', async () => {
      mockPrismaService.testCase.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.testCase.delete).not.toHaveBeenCalled();
    });
  });

  describe('getUseCaseCoverage', () => {
    it('should return coverage statistics for a use case', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.testCase.findMany.mockResolvedValue([
        { ...mockTestCase, testLevel: 'unit', status: 'implemented' },
        { ...mockTestCase, testLevel: 'integration', status: 'implemented' },
        { ...mockTestCase, testLevel: 'e2e', status: 'pending' },
      ]);

      const result = await service.getUseCaseCoverage('use-case-id');

      expect(result).toBeDefined();
      expect(mockPrismaService.useCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'use-case-id' },
      });
      expect(mockPrismaService.testCase.findMany).toHaveBeenCalledWith({
        where: { useCaseId: 'use-case-id' },
      });
    });

    it('should throw NotFoundException if use case not found', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(service.getUseCaseCoverage('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getComponentCoverage', () => {
    it('should return coverage statistics for components', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.testCase.groupBy.mockResolvedValue([
        {
          componentId: 'component-1',
          testLevel: 'unit',
          status: 'implemented',
          _count: { id: 5 },
        },
      ]);

      const result = await service.getComponentCoverage('project-id');

      expect(result).toBeDefined();
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-id' },
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getComponentCoverage('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCoverageGaps', () => {
    it('should return coverage gaps for a use case', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.testCase.findMany.mockResolvedValue([
        { ...mockTestCase, testLevel: 'unit', status: 'implemented' },
      ]);

      const result = await service.getCoverageGaps('use-case-id');

      expect(result).toBeDefined();
      expect(result.useCaseId).toBe('use-case-id');
      expect(mockPrismaService.useCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'use-case-id' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if use case not found', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(service.getCoverageGaps('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
