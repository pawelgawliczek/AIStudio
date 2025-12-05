/**
 * XSS Security Tests for ToolCallCard Component (ST-174)
 *
 * CRITICAL: Verifies that XSS attacks are blocked after replacing
 * dangerouslySetInnerHTML with react-syntax-highlighter
 *
 * Attack Vectors Tested:
 * - Script injection via tool input
 * - HTML injection via tool input
 * - Event handler injection (onerror, onclick)
 * - SVG-based XSS attacks
 * - Data URI XSS attacks
 * - Unicode bypass attempts
 *
 * Expected Behavior:
 * - All malicious content should be displayed as TEXT (escaped)
 * - No JavaScript execution should occur
 * - No DOM manipulation should happen
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallCard } from '../ToolCallCard';
import type { ToolCall } from '../../../utils/transcript-parser';

describe('ToolCallCard XSS Security Tests (ST-174)', () => {
  // ============================================================================
  // SCRIPT TAG INJECTION TESTS
  // ============================================================================

  describe('XSS-001: Script Tag Injection', () => {
    it('should block <script> tag execution in tool input', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Grep',
        input: {
          pattern: '<script>alert("XSS")</script>',
          file: 'test.ts',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Script tag should be displayed as text (escaped)
      expect(jsonContent.textContent).toContain('<script>');
      expect(jsonContent.textContent).toContain('</script>');

      // Verify no script tags in actual DOM (would indicate execution)
      const scripts = document.querySelectorAll('script');
      const hasXSSScript = Array.from(scripts).some((script) =>
        script.textContent?.includes('alert("XSS")')
      );
      expect(hasXSSScript).toBe(false);
    });

    it('should block <script> tag with src attribute', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Read',
        input: {
          file_path: '<script src="https://evil.com/xss.js"></script>',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text, not execute
      expect(jsonContent.textContent).toContain('<script');
      expect(jsonContent.textContent).toContain('evil.com');

      // No external script should be loaded
      const scripts = document.querySelectorAll('script[src*="evil.com"]');
      expect(scripts.length).toBe(0);
    });
  });

  // ============================================================================
  // HTML INJECTION TESTS
  // ============================================================================

  describe('XSS-002: HTML Tag Injection', () => {
    it('should block <img> tag with onerror handler', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Grep',
        input: {
          pattern: '<img src=x onerror=alert("XSS")>',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text
      expect(jsonContent.textContent).toContain('<img');
      expect(jsonContent.textContent).toContain('onerror');

      // No img tag with our onerror should exist in DOM
      const imgs = document.querySelectorAll('img[onerror]');
      expect(imgs.length).toBe(0);
    });

    it('should block <iframe> tag injection', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Edit',
        input: {
          content: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text
      expect(jsonContent.textContent).toContain('<iframe');

      // No iframe should be created
      const iframes = document.querySelectorAll('iframe');
      const hasXSSIframe = Array.from(iframes).some(
        (iframe) => iframe.src === "javascript:alert('XSS')"
      );
      expect(hasXSSIframe).toBe(false);
    });
  });

  // ============================================================================
  // EVENT HANDLER INJECTION TESTS
  // ============================================================================

  describe('XSS-003: Event Handler Injection', () => {
    it('should block onclick handler injection', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Write',
        input: {
          content: '<div onclick="alert(\'XSS\')">Click me</div>',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text
      expect(jsonContent.textContent).toContain('onclick');
      expect(jsonContent.textContent).toContain('alert');

      // No div with onclick should exist
      const divsWithOnClick = document.querySelectorAll('div[onclick]');
      expect(divsWithOnClick.length).toBe(0);
    });

    it('should block onload handler injection', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Edit',
        input: {
          content: '<body onload="alert(\'XSS\')">',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text
      expect(jsonContent.textContent).toContain('onload');
    });
  });

  // ============================================================================
  // SVG-BASED XSS TESTS
  // ============================================================================

  describe('XSS-004: SVG-Based XSS', () => {
    it('should block SVG with embedded script', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Write',
        input: {
          svg: '<svg><script>alert("XSS")</script></svg>',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text
      expect(jsonContent.textContent).toContain('<svg>');
      expect(jsonContent.textContent).toContain('<script>');

      // No SVG element should be created
      const svgs = document.querySelectorAll('svg');
      const hasXSSSvg = Array.from(svgs).some((svg) =>
        svg.innerHTML.includes('alert("XSS")')
      );
      expect(hasXSSSvg).toBe(false);
    });

    it('should block SVG with onload handler', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Edit',
        input: {
          svg: '<svg onload="alert(\'XSS\')">',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text
      expect(jsonContent.textContent).toContain('<svg');
      expect(jsonContent.textContent).toContain('onload');

      // No SVG with onload should exist
      const svgsWithOnload = document.querySelectorAll('svg[onload]');
      expect(svgsWithOnload.length).toBe(0);
    });
  });

  // ============================================================================
  // DATA URI XSS TESTS
  // ============================================================================

  describe('XSS-005: Data URI XSS', () => {
    it('should safely display data URI with JavaScript', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Edit',
        input: {
          url: 'data:text/html,<script>alert("XSS")</script>',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display as text
      expect(jsonContent.textContent).toContain('data:text/html');
      expect(jsonContent.textContent).toContain('<script>');

      // Verify no JavaScript execution
      const scripts = document.querySelectorAll('script');
      const hasXSSScript = Array.from(scripts).some((script) =>
        script.textContent?.includes('alert("XSS")')
      );
      expect(hasXSSScript).toBe(false);
    });
  });

  // ============================================================================
  // UNICODE BYPASS TESTS
  // ============================================================================

  describe('XSS-006: Unicode Bypass Attempts', () => {
    it('should block Unicode-encoded script tag', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Edit',
        input: {
          // Unicode-encoded <script>alert('XSS')</script>
          pattern: '\u003cscript\u003ealert(\u0027XSS\u0027)\u003c/script\u003e',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // Should display safely (JSON.stringify handles Unicode correctly)
      expect(jsonContent).toBeInTheDocument();

      // No script execution
      const scripts = document.querySelectorAll('script');
      const hasXSSScript = Array.from(scripts).some((script) =>
        script.textContent?.includes('alert')
      );
      expect(hasXSSScript).toBe(false);
    });
  });

  // ============================================================================
  // NESTED OBJECT XSS TESTS
  // ============================================================================

  describe('XSS-007: Nested Object Injection', () => {
    it('should safely display deeply nested malicious content', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Grep',
        input: {
          config: {
            pattern: '<script>alert("XSS")</script>',
            options: {
              handler: '<img src=x onerror=alert("XSS2")>',
              nested: {
                deep: '<iframe src="javascript:alert(\'XSS3\')"></iframe>',
              },
            },
          },
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // All malicious content should be displayed as text
      expect(jsonContent.textContent).toContain('<script>');
      expect(jsonContent.textContent).toContain('<img');
      expect(jsonContent.textContent).toContain('<iframe');

      // No actual DOM elements created
      expect(document.querySelectorAll('script').length).toBe(0);
      expect(document.querySelectorAll('img[onerror]').length).toBe(0);
      expect(document.querySelectorAll('iframe').length).toBe(0);
    });
  });

  // ============================================================================
  // COMBINED ATTACK TESTS
  // ============================================================================

  describe('XSS-008: Combined Attack Vectors', () => {
    it('should block multiple XSS attempts in single input', () => {
      const maliciousToolCall: ToolCall = {
        name: 'Write',
        input: {
          attack1: '<script>alert("XSS1")</script>',
          attack2: '<img src=x onerror=alert("XSS2")>',
          attack3: '<svg onload=alert("XSS3")>',
          attack4: 'data:text/html,<script>alert("XSS4")</script>',
        },
      };

      render(<ToolCallCard toolCall={maliciousToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const jsonContent = screen.getByTestId('tool-input-json');

      // All attacks should be displayed as text
      expect(jsonContent.textContent).toContain('<script>');
      expect(jsonContent.textContent).toContain('<img');
      expect(jsonContent.textContent).toContain('<svg');
      expect(jsonContent.textContent).toContain('data:text/html');

      // No malicious elements in DOM
      expect(document.querySelectorAll('script').length).toBe(0);
      expect(document.querySelectorAll('img[onerror]').length).toBe(0);
      expect(document.querySelectorAll('svg[onload]').length).toBe(0);
    });
  });

  // ============================================================================
  // OUTPUT XSS TESTS
  // ============================================================================

  describe('XSS-009: Output/Result XSS', () => {
    it('should safely display malicious content in tool result', () => {
      const toolCall: ToolCall = {
        name: 'Read',
        input: { file_path: 'test.ts' },
      };

      const maliciousResult = {
        name: 'Read',
        output: {
          content: '<script>alert("XSS in output")</script>',
          lines: 10,
        },
      };

      render(<ToolCallCard toolCall={toolCall} result={maliciousResult} />);

      const outputHeader = screen.getByText(/Output/i);
      fireEvent.click(outputHeader);

      // Output uses plain <pre> tag with JSON.stringify (safe)
      const outputContent = screen.getByText(/content/i).parentElement;
      expect(outputContent?.textContent).toContain('<script>');

      // No script execution
      const scripts = document.querySelectorAll('script');
      const hasXSSScript = Array.from(scripts).some((script) =>
        script.textContent?.includes('alert("XSS in output")')
      );
      expect(hasXSSScript).toBe(false);
    });
  });
});
