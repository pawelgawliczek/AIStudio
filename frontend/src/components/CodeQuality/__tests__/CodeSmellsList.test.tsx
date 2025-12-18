/**
 * Tests for CodeSmellsList component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CodeSmellsList } from '../CodeSmellsList';

const mockIssues = [
  {
    severity: 'critical' as const,
    type: 'Security Vulnerability',
    count: 5,
    filesAffected: 3,
    sampleFiles: ['file1.ts', 'file2.ts'],
  },
  {
    severity: 'high' as const,
    type: 'Code Complexity',
    count: 10,
    filesAffected: 7,
    sampleFiles: ['file3.ts'],
  },
];

describe('CodeSmellsList', () => {
  it('should render issues list', () => {
    render(<CodeSmellsList issues={mockIssues} />);
    expect(screen.getByText('Security Vulnerability')).toBeInTheDocument();
    expect(screen.getByText('Code Complexity')).toBeInTheDocument();
  });

  it('should filter by severity', () => {
    render(<CodeSmellsList issues={mockIssues} />);

    const criticalButton = screen.getByText('CRITICAL');
    fireEvent.click(criticalButton);

    expect(screen.getByText('Security Vulnerability')).toBeInTheDocument();
    expect(screen.queryByText('Code Complexity')).not.toBeInTheDocument();
  });

  it('should call onCreateStory when button clicked', () => {
    const onCreateStory = vi.fn();
    render(<CodeSmellsList issues={mockIssues} onCreateStory={onCreateStory} />);

    const createButtons = screen.getAllByText('Create Story');
    fireEvent.click(createButtons[0]);

    expect(onCreateStory).toHaveBeenCalledWith(mockIssues[0]);
  });

  it('should expand issue details', () => {
    render(<CodeSmellsList issues={mockIssues} />);

    const expandButtons = screen.getAllByLabelText(/expand details/i);
    fireEvent.click(expandButtons[0]);

    expect(screen.getByText('file1.ts')).toBeInTheDocument();
  });
});
