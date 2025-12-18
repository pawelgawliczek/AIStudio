/**
 * Content Security Utility (ST-177)
 * Shared redaction logic for sensitive data
 *
 * Extracted from TranscriptsService to avoid duplication.
 * Used by: upload_artifact_from_file, TranscriptsService
 */

export const REDACTION_PATTERNS = {
  // API Keys (OpenAI, Anthropic, etc.)
  // ST-307: Restored proper minimum key lengths for security
  OPENAI_KEY: /sk-[A-Za-z0-9]{32,}/g,
  ANTHROPIC_KEY: /sk-ant-[A-Za-z0-9-_]{32,}/g,
  GENERIC_KEY: /[A-Za-z0-9_-]{32,}(?=["'\s,}])/g, // Conservative pattern

  // AWS Keys
  AWS_ACCESS_KEY: /AKIA[0-9A-Z]{16}/g,
  AWS_SECRET_KEY: /(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*['"]?[A-Za-z0-9+/=]{40}['"]?/gi,

  // JWTs
  JWT: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,

  // Email addresses
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Generic secrets
  PASSWORD: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
  SECRET: /(?:secret|token|api_key|apikey)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
};

export interface RedactionResult {
  redactedContent: string;
  redactionApplied: boolean;
  redactionCount: number;
  patterns: string[];
}

/**
 * Redact sensitive data from content
 *
 * @param content - Content to redact (null/undefined will be treated as empty string)
 * @returns Object with redacted content, flag indicating if redaction occurred, count, and patterns matched
 */
export function redactSensitiveData(content: string | null | undefined): RedactionResult {
  // Handle null/undefined gracefully
  if (content == null) {
    return {
      redactedContent: '',
      redactionApplied: false,
      redactionCount: 0,
      patterns: [],
    };
  }

  let redactedContent = content;
  let redactionCount = 0;
  const matchedPatterns: string[] = [];

  // Apply each redaction pattern
  for (const [key, pattern] of Object.entries(REDACTION_PATTERNS)) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      matchedPatterns.push(key);
      redactionCount += matches.length;

      // Determine replacement text based on pattern type
      let replacement: string;
      if (key.includes('EMAIL')) {
        replacement = '[REDACTED-EMAIL]';
      } else if (key.includes('PASSWORD') || key.includes('SECRET')) {
        replacement = '[REDACTED-SECRET]';
      } else {
        // All keys (OPENAI, ANTHROPIC, AWS, JWT, etc.) use [REDACTED-KEY]
        replacement = '[REDACTED-KEY]';
      }

      redactedContent = redactedContent.replace(pattern, replacement);
    }
  }

  return {
    redactedContent,
    redactionApplied: redactionCount > 0,
    redactionCount,
    patterns: matchedPatterns,
  };
}
