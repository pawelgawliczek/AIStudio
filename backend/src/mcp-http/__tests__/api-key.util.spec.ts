/**
 * Unit Tests for API Key Cryptography Utilities (Task 2.2a - CRITICAL SECURITY)
 *
 * Tests bcrypt.compare() pattern for secure API key validation.
 * Ensures constant-time comparison to prevent timing attacks.
 *
 * @see ST-163 Task 2.2a: Implement Bcrypt Compare Pattern
 */

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { generateApiKey, validateApiKey, extractKeyPrefix } from '../utils/api-key.util';

// Mock Prisma
const mockPrisma = {
  apiKey: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('API Key Cryptography (Task 2.2a - CRITICAL)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateApiKey', () => {
    it('should generate API key with project ID prefix', async () => {
      const projectId = 'abc12345-6789-0123-4567-890123456789';
      const result = await generateApiKey(projectId, 'Test Key');

      // Key format: proj_{projectId_prefix}_{random_bytes}
      expect(result.key).toMatch(/^proj_[a-zA-Z0-9]{8}_[A-Za-z0-9_-]+$/);
      expect(result.key).toContain('proj_abc12345_');
    });

    it('should generate unique hashes for same key (bcrypt salt randomness)', async () => {
      const projectId = 'test-project-id';
      const result1 = await generateApiKey(projectId, 'Key 1');
      const result2 = await generateApiKey(projectId, 'Key 1');

      // Same input should produce different hashes due to bcrypt salt
      expect(result1.keyData.keyHash).not.toEqual(result2.keyData.keyHash);
    });

    it('should extract correct prefix for lookup', async () => {
      const projectId = 'abc12345-6789-0123-4567-890123456789';
      const result = await generateApiKey(projectId, 'Test Key');

      // Prefix should be first 12 characters
      expect(result.keyData.keyPrefix).toHaveLength(12);
      expect(result.key).toStartWith(result.keyData.keyPrefix);
    });

    it('should hash key with bcrypt cost factor 10', async () => {
      const projectId = 'test-project-id';
      const result = await generateApiKey(projectId, 'Test Key');

      // Bcrypt hash format: $2b$10$...
      expect(result.keyData.keyHash).toMatch(/^\$2[ayb]\$10\$/);
    });

    it('should use cryptographically secure random bytes', async () => {
      const projectId = 'test-project-id';
      const result1 = await generateApiKey(projectId, 'Key 1');
      const result2 = await generateApiKey(projectId, 'Key 2');

      // Keys should be unique
      expect(result1.key).not.toEqual(result2.key);

      // Keys should have sufficient entropy (>32 random bytes = >43 base64url chars)
      const randomPart = result1.key.split('_')[2];
      expect(randomPart.length).toBeGreaterThan(42);
    });

    it('should return key and keyData separately', async () => {
      const projectId = 'test-project-id';
      const result = await generateApiKey(projectId, 'Test Key');

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('keyData');
      expect(result.keyData).toHaveProperty('keyHash');
      expect(result.keyData).toHaveProperty('keyPrefix');
      expect(result.keyData).toHaveProperty('name');
      expect(result.keyData).toHaveProperty('projectId');
    });
  });

  describe('validateApiKey', () => {
    const mockApiKey = {
      id: 'key-id-123',
      projectId: 'proj-id-456',
      keyHash: '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      keyPrefix: 'proj_abc123_',
      name: 'Test Key',
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: new Date(),
    };

    beforeEach(async () => {
      // Generate real bcrypt hash for testing
      const testKey = 'proj_abc123_testkey123456789';
      mockApiKey.keyHash = await bcrypt.hash(testKey, 10);
      mockApiKey.keyPrefix = testKey.substring(0, 12);
    });

    it('should validate correct API key using bcrypt.compare()', async () => {
      const providedKey = 'proj_abc123_testkey123456789';

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue(mockApiKey);

      const result = await validateApiKey(providedKey, mockPrisma as any);

      expect(result).toEqual(mockApiKey);
      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyPrefix: 'proj_abc123_' },
      });
    });

    it('should reject incorrect API key', async () => {
      const wrongKey = 'proj_abc123_wrongkey987654321';

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);

      await expect(validateApiKey(wrongKey, mockPrisma as any))
        .rejects
        .toThrow('Invalid API key');
    });

    it('should use constant-time comparison', async () => {
      const providedKey = 'proj_abc123_testkey123456789';

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue(mockApiKey);

      // Measure time for correct key
      const start1 = Date.now();
      await validateApiKey(providedKey, mockPrisma as any);
      const time1 = Date.now() - start1;

      // Measure time for incorrect key
      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      const start2 = Date.now();
      try {
        await validateApiKey('proj_abc123_wrongkey987654321', mockPrisma as any);
      } catch {}
      const time2 = Date.now() - start2;

      // Timing difference should be minimal (bcrypt.compare is constant-time)
      // Allow 50ms tolerance for system variance
      expect(Math.abs(time1 - time2)).toBeLessThan(50);
    });

    it('should reject revoked API keys', async () => {
      const providedKey = 'proj_abc123_testkey123456789';

      mockPrisma.apiKey.findUnique.mockResolvedValue({
        ...mockApiKey,
        revokedAt: new Date(),
      });

      await expect(validateApiKey(providedKey, mockPrisma as any))
        .rejects
        .toThrow('API key revoked');
    });

    it('should reject expired API keys', async () => {
      const providedKey = 'proj_abc123_testkey123456789';

      mockPrisma.apiKey.findUnique.mockResolvedValue({
        ...mockApiKey,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      await expect(validateApiKey(providedKey, mockPrisma as any))
        .rejects
        .toThrow('API key expired');
    });

    it('should perform dummy bcrypt hash when key not found (prevent timing attacks)', async () => {
      const providedKey = 'proj_nonexist_123456789';

      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const bcryptHashSpy = jest.spyOn(bcrypt, 'hash');

      await expect(validateApiKey(providedKey, mockPrisma as any))
        .rejects
        .toThrow('Invalid API key');

      // Verify dummy hash was called
      expect(bcryptHashSpy).toHaveBeenCalledWith('dummy', 10);
    });

    it('should update lastUsedAt timestamp on successful validation', async () => {
      const providedKey = 'proj_abc123_testkey123456789';

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue(mockApiKey);

      await validateApiKey(providedKey, mockPrisma as any);

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: mockApiKey.id },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('should use prefix-based lookup (not full key hash)', async () => {
      const providedKey = 'proj_abc123_testkey123456789';

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue(mockApiKey);

      await validateApiKey(providedKey, mockPrisma as any);

      // Verify lookup is by prefix, not by hashing the key
      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyPrefix: 'proj_abc123_' },
      });
      expect(mockPrisma.apiKey.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { keyHash: expect.anything() } })
      );
    });
  });

  describe('extractKeyPrefix', () => {
    it('should extract first 12 characters as prefix', () => {
      const key = 'proj_abc123_xyz789randomdata';
      const prefix = extractKeyPrefix(key);

      expect(prefix).toBe('proj_abc123_');
      expect(prefix).toHaveLength(12);
    });

    it('should handle keys shorter than 12 characters', () => {
      const key = 'shortkey';
      const prefix = extractKeyPrefix(key);

      expect(prefix).toBe('shortkey');
    });
  });
});
