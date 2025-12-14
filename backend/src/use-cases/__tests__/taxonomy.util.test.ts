/**
 * Unit Tests for Taxonomy Utility Functions
 * Tests levenshteinDistance, findSimilarAreas, and normalizeArea functions
 */

import {
  levenshteinDistance,
  findSimilarAreas,
  normalizeArea,
  SIMILARITY_THRESHOLD,
} from '../taxonomy.util';

describe('Taxonomy Utilities', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('authentication', 'authentication')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should return correct distance for simple cases', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
      expect(levenshteinDistance('cat', 'cut')).toBe(1);
    });

    it('should handle complete string replacement', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3);
    });

    it('should handle insertions', () => {
      expect(levenshteinDistance('test', 'testing')).toBe(3);
    });

    it('should handle deletions', () => {
      expect(levenshteinDistance('testing', 'test')).toBe(3);
    });

    it('should be case-sensitive', () => {
      expect(levenshteinDistance('Test', 'test')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    it('should handle unicode characters', () => {
      expect(levenshteinDistance('café', 'cafe')).toBe(1);
      expect(levenshteinDistance('naïve', 'naive')).toBe(1);
    });

    it('should handle special characters', () => {
      expect(levenshteinDistance('user-auth', 'user_auth')).toBe(1);
      expect(levenshteinDistance('api/v1', 'api/v2')).toBe(1);
    });

    it('should handle long strings', () => {
      const str1 = 'authentication-service';
      const str2 = 'authorization-service';
      expect(levenshteinDistance(str1, str2)).toBeGreaterThan(0);
    });
  });

  describe('normalizeArea', () => {
    it('should trim whitespace', () => {
      expect(normalizeArea('  Authentication  ')).toBe('Authentication');
    });

    it('should convert to title case', () => {
      expect(normalizeArea('authentication')).toBe('Authentication');
      expect(normalizeArea('AUTHENTICATION')).toBe('Authentication');
    });

    it('should handle multi-word areas', () => {
      expect(normalizeArea('user management')).toBe('User Management');
      expect(normalizeArea('USER MANAGEMENT')).toBe('User Management');
    });

    it('should handle hyphenated words', () => {
      expect(normalizeArea('user-authentication')).toBe('User-Authentication');
    });

    it('should handle underscored words', () => {
      expect(normalizeArea('user_authentication')).toBe('User_Authentication');
    });

    it('should handle empty string', () => {
      expect(normalizeArea('')).toBe('');
    });

    it('should preserve special characters', () => {
      expect(normalizeArea('api/v1')).toBe('Api/V1');
    });

    it('should handle unicode characters', () => {
      expect(normalizeArea('café management')).toBe('Café Management');
    });

    it('should handle mixed case', () => {
      expect(normalizeArea('uSeR AuThEnTiCaTiOn')).toBe('User Authentication');
    });
  });

  describe('findSimilarAreas', () => {
    const existingAreas = [
      'Authentication',
      'Authorization',
      'User Management',
      'Reporting',
      'Billing',
      'API Gateway',
      'Data Processing',
    ];

    it('should find exact match (case-insensitive)', () => {
      const result = findSimilarAreas('authentication', existingAreas);
      expect(result).toHaveLength(1);
      expect(result[0].area).toBe('Authentication');
      expect(result[0].distance).toBe(0);
    });

    it('should find similar areas within threshold', () => {
      const result = findSimilarAreas('Authentcation', existingAreas); // Missing 'i'
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].area).toBe('Authentication');
      expect(result[0].distance).toBeLessThanOrEqual(SIMILARITY_THRESHOLD);
    });

    it('should sort results by distance', () => {
      const result = findSimilarAreas('Auth', existingAreas);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].distance).toBeGreaterThanOrEqual(result[i - 1].distance);
      }
    });

    it('should return empty array when no similar areas found', () => {
      const result = findSimilarAreas('Completely Different', existingAreas);
      expect(result).toEqual([]);
    });

    it('should handle empty existing areas', () => {
      const result = findSimilarAreas('Authentication', []);
      expect(result).toEqual([]);
    });

    it('should handle typos', () => {
      const result = findSimilarAreas('Autentication', existingAreas); // Missing 'h'
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].area).toBe('Authentication');
    });

    it('should handle plural/singular variations', () => {
      const result = findSimilarAreas('Reportings', existingAreas);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].area).toBe('Reporting');
    });

    it('should normalize input before comparison', () => {
      const result = findSimilarAreas('  AUTHENTICATION  ', existingAreas);
      expect(result[0].area).toBe('Authentication');
      expect(result[0].distance).toBe(0);
    });

    it('should handle unicode characters', () => {
      const areasWithUnicode = ['Café Management', 'User Authentication'];
      const result = findSimilarAreas('Cafe Management', areasWithUnicode);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].area).toBe('Café Management');
      expect(result[0].distance).toBeLessThanOrEqual(SIMILARITY_THRESHOLD);
    });

    it('should respect similarity threshold', () => {
      const result = findSimilarAreas('X', existingAreas);
      result.forEach((match) => {
        expect(match.distance).toBeLessThanOrEqual(SIMILARITY_THRESHOLD);
      });
    });

    it('should limit results to max 5 suggestions', () => {
      const manyAreas = Array.from({ length: 20 }, (_, i) => `Area ${i}`);
      const result = findSimilarAreas('Area', manyAreas);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long area names', () => {
      const longName = 'A'.repeat(1000);
      expect(normalizeArea(longName)).toBe(longName.toLowerCase());
    });

    it('should handle numbers in area names', () => {
      expect(normalizeArea('api v2')).toBe('Api V2');
    });

    it('should handle special characters in normalization', () => {
      expect(normalizeArea('user@authentication')).toBe('User@Authentication');
    });

    it('should handle null-like strings', () => {
      expect(normalizeArea('null')).toBe('Null');
      expect(normalizeArea('undefined')).toBe('Undefined');
    });

    it('should handle very similar strings at threshold boundary', () => {
      const area = 'Authentication';
      const similar = 'Auth'; // Distance should be > threshold
      expect(levenshteinDistance(area, similar)).toBeGreaterThan(SIMILARITY_THRESHOLD);
    });
  });
});
