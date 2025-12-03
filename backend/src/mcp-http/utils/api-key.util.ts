/**
 * API Key Utility Functions (Tasks 2.2, 2.2a - CRITICAL SECURITY)
 *
 * Implements secure API key generation and validation using bcrypt.compare() pattern.
 * Prevents timing attacks with constant-time comparison.
 *
 * @see ST-163 Task 2.2: Implement API Key Generation Utility
 * @see ST-163 Task 2.2a: Implement Bcrypt Compare Pattern
 */

import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Bcrypt cost factor (10 = ~100ms per hash)
const BCRYPT_ROUNDS = 10;

// API key format: proj_{projectId_8chars}_{32_random_bytes_base64url}
// Example: proj_abc12345_dGVzdGtleTE...
const KEY_PREFIX_LENGTH = 12; // "proj_abc123_"

/**
 * API Key Data Structure (for database storage)
 */
export interface ApiKeyData {
  keyHash: string;      // bcrypt hash of full key
  keyPrefix: string;    // First 12 chars for fast lookup
  name: string;
  projectId: string;
}

/**
 * Generate a new API key with secure random bytes and bcrypt hash
 *
 * @param projectId - Project UUID
 * @param name - Human-readable key name
 * @returns Object with plaintext key (return to user ONCE) and keyData (store in database)
 *
 * @example
 * const { key, keyData } = await generateApiKey('abc12345-...', 'Production Key');
 * // key: "proj_abc12345_dGVzdGtleTE2Mzg4..." (give to user)
 * // keyData: { keyHash: "$2b$10$...", keyPrefix: "proj_abc123_", name: "Production Key", projectId: "abc12345-..." }
 */
export async function generateApiKey(
  projectId: string,
  name: string,
): Promise<{ key: string; keyData: ApiKeyData }> {
  // Generate 32 random bytes for high entropy
  const randomBytes = crypto.randomBytes(32);

  // Extract first 8 chars of project ID for key prefix
  const projectPrefix = projectId.substring(0, 8);

  // Construct API key: proj_{projectPrefix}_{randomBytes_base64url}
  const apiKey = `proj_${projectPrefix}_${randomBytes.toString('base64url')}`;

  // Hash the full key with bcrypt (generates unique salt each time)
  // IMPORTANT: DO NOT use this hash for lookup - bcrypt is non-deterministic
  const keyHash = await bcrypt.hash(apiKey, BCRYPT_ROUNDS);

  // Extract prefix for fast database lookup (first 12 chars)
  const keyPrefix = apiKey.substring(0, KEY_PREFIX_LENGTH);

  return {
    key: apiKey,        // Return this to user ONCE - never store plaintext
    keyData: {
      keyHash,          // Store this in database (bcrypt hash)
      keyPrefix,        // Store this for fast lookup
      name,
      projectId,
    },
  };
}

/**
 * Validate an API key using secure bcrypt.compare() pattern
 *
 * SECURITY NOTES:
 * 1. DO NOT use bcrypt.hash() for lookup - bcrypt is non-deterministic (random salt)
 * 2. DO use keyPrefix for fast database lookup
 * 3. DO use bcrypt.compare() for constant-time verification
 * 4. DO perform dummy hash when key not found (prevent timing attacks)
 *
 * @param providedKey - The API key provided by the client
 * @param prisma - PrismaService instance for database queries
 * @returns ApiKey record if valid
 * @throws UnauthorizedException if key is invalid, revoked, or expired
 *
 * @example
 * const apiKey = await validateApiKey('proj_abc12345_dGVzdGtleTE2Mzg4...', prisma);
 * console.log(apiKey.projectId); // "abc12345-..."
 */
export async function validateApiKey(providedKey: string, prisma: any): Promise<any> {
  // Extract prefix for fast lookup (first 12 chars)
  const keyPrefix = extractKeyPrefix(providedKey);

  // Fast lookup by prefix (indexed column)
  const storedKey = await prisma.apiKey.findUnique({
    where: { keyPrefix },
  });

  if (!storedKey) {
    // Perform dummy bcrypt hash to prevent timing attacks
    // Makes "key not found" take same time as "key found but invalid"
    await bcrypt.hash('dummy', BCRYPT_ROUNDS);
    throw new UnauthorizedException('Invalid API key');
  }

  // Check if revoked
  if (storedKey.revokedAt) {
    throw new UnauthorizedException('API key revoked');
  }

  // Check if expired
  if (storedKey.expiresAt && new Date() > storedKey.expiresAt) {
    throw new UnauthorizedException('API key expired');
  }

  // Verify key using bcrypt.compare (constant-time comparison)
  // This is the CORRECT pattern - DO NOT use bcrypt.hash() here!
  const isValid = await bcrypt.compare(providedKey, storedKey.keyHash);

  if (!isValid) {
    throw new UnauthorizedException('Invalid API key');
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: storedKey.id },
    data: { lastUsedAt: new Date() },
  });

  return storedKey;
}

/**
 * Extract key prefix for database lookup
 *
 * @param key - Full API key
 * @returns First 12 characters (e.g., "proj_abc123_")
 */
export function extractKeyPrefix(key: string): string {
  return key.substring(0, KEY_PREFIX_LENGTH);
}
