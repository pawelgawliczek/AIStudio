import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService - Session Management', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword123',
    role: UserRole.dev,
    refreshToken: 'hashedRefreshToken',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '24h', // Updated to 24 hours for ST-11
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_REFRESH_EXPIRES_IN: '30d', // Updated to 30 days for ST-11
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ST-11: 24-hour session timeout', () => {
    it('should generate access token with 24-hour expiration', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      jest.spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      await service.login(mockUser);

      // Verify JWT is configured with 24h expiration
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        }),
        expect.objectContaining({
          expiresIn: '24h',
        })
      );
    });

    it('should generate refresh token with 30-day expiration', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      jest.spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      await service.login(mockUser);

      // Verify refresh token is configured with 30d expiration
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        expect.objectContaining({
          expiresIn: '30d',
        })
      );
    });
  });

  describe('ST-11: Token refresh flow', () => {
    it('should successfully refresh tokens', async () => {
      const bcrypt = require('bcrypt');
      const mockAccessToken = 'new-access-token';
      const mockRefreshToken = 'new-refresh-token';
      const oldRefreshToken = 'old-refresh-token';

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        refreshToken: 'hashed-refresh-token',
      });

      jest.spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      bcrypt.compare.mockResolvedValue(true);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.refreshTokens(mockUser.id, oldRefreshToken);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });
    });

    it('should reject refresh with invalid token', async () => {
      const bcrypt = require('bcrypt');

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        refreshToken: 'different-hashed-token',
      });

      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.refreshTokens(mockUser.id, 'invalid-refresh-token')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject refresh when user has no refresh token', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        refreshToken: null,
      });

      await expect(
        service.refreshTokens(mockUser.id, 'any-token')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ST-11: Logout flow', () => {
    it('should clear refresh token on logout', async () => {
      const updateSpy = jest.spyOn(prismaService.user, 'update').mockResolvedValue({
        ...mockUser,
        refreshToken: null,
      });

      await service.logout(mockUser.id);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: null },
      });
    });
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      const bcrypt = require('bcrypt');

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.validateUser(mockUser.email, 'password123');

      expect(result).toEqual(expect.objectContaining({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
      }));
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException with invalid credentials', async () => {
      const bcrypt = require('bcrypt');

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.validateUser(mockUser.email, 'wrongpassword')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create new user and return tokens', async () => {
      const newUserData = {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.register(
        newUserData.name,
        newUserData.email,
        newUserData.password
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should throw BadRequestException if user already exists', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);

      await expect(
        service.register('Test', 'test@example.com', 'password')
      ).rejects.toThrow(BadRequestException);
    });
  });
});
