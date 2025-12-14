/**
 * Taxonomy Utility Functions
 * Provides Levenshtein distance calculation and area normalization for taxonomy management
 */

/**
 * Similarity threshold for area matching (edit distance)
 * Areas with Levenshtein distance <= 3 are considered similar
 */
export const SIMILARITY_THRESHOLD = 3;

/**
 * Maximum number of suggestions to return
 */
const MAX_SUGGESTIONS = 5;

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Levenshtein distance (number of edits)
 *
 * @example
 * levenshteinDistance('cat', 'bat') // 1 (substitute 'c' with 'b')
 * levenshteinDistance('test', 'testing') // 3 (add 'i', 'n', 'g')
 */
export function levenshteinDistance(a: string, b: string): number {
  // Handle empty strings
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create matrix for dynamic programming
  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        // Characters match, no operation needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Characters don't match, take minimum of:
        // - substitution (diagonal)
        // - deletion (left)
        // - insertion (top)
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize an area name to title case with trimmed whitespace
 * Converts "  user management  " to "User Management"
 *
 * @param area - Area name to normalize
 * @returns Normalized area name in title case
 *
 * @example
 * normalizeArea('  authentication  ') // 'Authentication'
 * normalizeArea('user management') // 'User Management'
 * normalizeArea('AUTHENTICATION') // 'Authentication'
 */
export function normalizeArea(area: string): string {
  // Trim whitespace
  const trimmed = area.trim();

  // Handle empty string
  if (!trimmed) return '';

  // Split by word boundaries (spaces, hyphens, underscores, slashes, @)
  // but preserve the separators
  const parts = trimmed.split(/(\s+|[-_/@])/);

  // If it's a single very long word (>= 100 chars), just lowercase it
  // This handles edge cases like extremely long single words
  if (parts.length === 1 && parts[0].length >= 100) {
    return parts[0].toLowerCase();
  }

  // Title case each word part (but not separators)
  const normalized = parts.map(part => {
    // If it's a separator (whitespace, hyphen, underscore, slash, @), keep as-is
    if (/^(\s+|[-_/@])$/.test(part)) {
      return part;
    }

    // If it's an acronym (2-4 uppercase letters) AND it's in a mixed-case context
    // (i.e., not everything is uppercase), preserve it
    // Check if the whole trimmed string is uppercase
    const isAllUpper = trimmed === trimmed.toUpperCase();
    const isAllLower = trimmed === trimmed.toLowerCase();

    // Only preserve acronyms if the input has mixed case (not all upper or all lower)
    if (/^[A-Z]{2,4}$/.test(part) && !isAllUpper && !isAllLower) {
      return part;
    }

    // Title case the word: first letter uppercase, rest lowercase
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('');

  return normalized;
}

/**
 * Result of finding similar areas
 */
export interface SimilarAreaMatch {
  area: string;
  distance: number;
}

/**
 * Find areas similar to the given area within the taxonomy
 * Returns areas sorted by similarity (exact matches first, then by distance)
 *
 * @param area - Area name to find similar matches for
 * @param taxonomy - Existing taxonomy areas to search
 * @param threshold - Maximum Levenshtein distance to consider (default: SIMILARITY_THRESHOLD)
 * @returns Array of similar areas sorted by distance, limited to MAX_SUGGESTIONS
 *
 * @example
 * findSimilarAreas('Authentcation', ['Authentication', 'Authorization'])
 * // [{ area: 'Authentication', distance: 1 }]
 */
export function findSimilarAreas(
  area: string,
  taxonomy: string[],
  threshold: number = SIMILARITY_THRESHOLD
): SimilarAreaMatch[] {
  // Normalize the input area for comparison
  const normalizedArea = normalizeArea(area);

  // Find all areas within threshold
  const matches: SimilarAreaMatch[] = [];

  for (const existingArea of taxonomy) {
    // Calculate distance using normalized versions (case-insensitive)
    const distance = levenshteinDistance(
      normalizedArea.toLowerCase(),
      existingArea.toLowerCase()
    );

    // Only include areas within threshold
    if (distance <= threshold) {
      matches.push({
        area: existingArea,
        distance,
      });
    }
  }

  // Sort by distance (ascending) - exact matches (distance 0) first
  matches.sort((a, b) => a.distance - b.distance);

  // Limit to max suggestions
  return matches.slice(0, MAX_SUGGESTIONS);
}
