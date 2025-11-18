/**
 * Tests for AnalysisRefreshButton component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisRefreshButton } from '../AnalysisRefreshButton';

describe('AnalysisRefreshButton', () => {
  it('should render refresh button', () => {
    render(
      <AnalysisRefreshButton
        isAnalyzing={false}
        analysisStatus={null}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByText('Refresh Analysis')).toBeInTheDocument();
  });

  it('should show analyzing state', () => {
    render(
      <AnalysisRefreshButton
        isAnalyzing={true}
        analysisStatus={{ status: 'running', message: 'Analyzing...' }}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });

  it('should call onRefresh when clicked', () => {
    const onRefresh = vi.fn();
    render(
      <AnalysisRefreshButton
        isAnalyzing={false}
        analysisStatus={null}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByText('Refresh Analysis'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('should be disabled when analyzing', () => {
    const { container } = render(
      <AnalysisRefreshButton
        isAnalyzing={true}
        analysisStatus={{ status: 'running' }}
        onRefresh={vi.fn()}
      />
    );
    const button = container.querySelector('button');
    expect(button).toBeDisabled();
  });
});
