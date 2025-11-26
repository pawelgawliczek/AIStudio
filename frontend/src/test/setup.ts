import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Extend Vitest's expect with jest-dom matchers
expect.extend({});

// Make jest available globally for compatibility with jest-style tests
// @ts-expect-error - Vitest's vi is compatible enough for our test needs
global.jest = vi;
