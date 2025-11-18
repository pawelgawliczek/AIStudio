/**
 * Tests for FileDetailsPanel component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileDetailsPanel } from '../FileDetailsPanel';

describe('FileDetailsPanel', () => {
  it('should show loading state', () => {
    render(<FileDetailsPanel file={null} loading={true} />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('should show empty state when no file selected', () => {
    render(<FileDetailsPanel file={null} loading={false} />);
    expect(screen.getByText(/select a file/i)).toBeInTheDocument();
  });

  it('should render file details when file provided', () => {
    const mockFile = {
      filePath: 'src/test.ts',
      language: 'typescript',
      riskScore: 50,
      loc: 200,
      complexity: 10,
      cognitiveComplexity: 15,
      maintainabilityIndex: 70,
      coverage: 75,
      churnCount: 3,
      linesChanged: 50,
      churnRate: 5,
      lastModified: new Date(),
      recentChanges: [],
      issues: [],
      importedBy: [],
      imports: [],
      couplingScore: 'low' as const,
    };

    render(<FileDetailsPanel file={mockFile} loading={false} />);
    expect(screen.getByText('test.ts')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
