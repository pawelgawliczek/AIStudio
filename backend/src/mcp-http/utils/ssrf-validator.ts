/**
 * SSRF Prevention Utility (Task 5.4)
 *
 * Validates URLs in tool arguments to prevent Server-Side Request Forgery (SSRF) attacks.
 * Blocks internal network addresses and localhost to prevent attackers from accessing
 * internal services or sensitive endpoints.
 *
 * Security Features:
 * - Blocks localhost and loopback addresses
 * - Blocks private IP ranges (RFC 1918)
 * - Blocks link-local addresses
 * - Only allows HTTP/HTTPS protocols
 * - Validates URL format before checking
 *
 * @see ST-163 Task 5.4: SSRF Prevention for Tool Arguments
 */

import { BadRequestException } from '@nestjs/common';

/**
 * Blocked host prefixes and addresses
 * Includes localhost, loopback, private networks, and link-local addresses
 */
const BLOCKED_HOSTS = [
  // Localhost and loopback
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',

  // Private IPv4 ranges (RFC 1918)
  '10.',          // 10.0.0.0/8
  '172.16.',      // 172.16.0.0/12
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',     // 192.168.0.0/16

  // Link-local addresses
  '169.254.',     // IPv4 link-local
  'fe80:',        // IPv6 link-local

  // IPv6 private ranges
  'fc00:',        // IPv6 unique local addresses
  'fd00:',        // IPv6 unique local addresses
];

/**
 * Allowed URL protocols
 * Only HTTP and HTTPS are permitted
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validates a URL to prevent SSRF attacks
 *
 * @param url - The URL to validate
 * @throws BadRequestException if URL is invalid or blocked
 */
export function validateUrl(url: string): void {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid URL format');
  }

  // Check protocol
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new BadRequestException('Only HTTP/HTTPS URLs allowed');
  }

  // Check for blocked hosts
  const hostname = parsed.hostname.toLowerCase();

  for (const blocked of BLOCKED_HOSTS) {
    if (hostname.startsWith(blocked) || hostname === blocked.replace(/\.$/, '')) {
      throw new BadRequestException('Internal URLs not allowed');
    }
  }

  // Additional checks could be added here:
  // - DNS resolution to check for internal IPs (prevents DNS rebinding)
  // - Port restrictions (block non-standard ports)
  // - Domain whitelist (only allow specific domains)
}

/**
 * Validates tool arguments for potential SSRF vulnerabilities
 * Checks all string arguments for URL patterns and validates them
 *
 * @param toolName - The name of the tool being executed
 * @param args - The tool arguments to validate
 * @throws BadRequestException if any URL argument is invalid or blocked
 */
export function validateToolArguments(toolName: string, args: Record<string, any>): void {
  if (!args || typeof args !== 'object') {
    return;
  }

  // Recursively check all arguments
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // Check if string looks like a URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        validateUrl(value);
      }
    } else if (Array.isArray(value)) {
      // Check array elements
      value.forEach((item, index) => {
        if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
          validateUrl(item);
        }
      });
    } else if (value && typeof value === 'object') {
      // Recursively check nested objects
      validateToolArguments(toolName, value);
    }
  }
}
