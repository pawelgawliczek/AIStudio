import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { expect, afterEach, vi } from 'vitest';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Extend Vitest's expect with jest-dom matchers
expect.extend({});

// Make jest available globally for compatibility with jest-style tests
// @ts-expect-error - Vitest's vi is compatible enough for our test needs
global.jest = vi;

// Mock react-syntax-highlighter to avoid ESM issues in tests (ST-174)
vi.mock('react-syntax-highlighter', () => {
  const MockSyntaxHighlighter: any = vi.fn(({ children, ...props }) =>
    React.createElement('pre', { ...props }, children)
  );
  MockSyntaxHighlighter.registerLanguage = vi.fn();
  return {
    Light: MockSyntaxHighlighter,
  };
});

vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/json', () => ({
  default: vi.fn(),
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/hljs', () => ({
  vs2015: {},
}));
