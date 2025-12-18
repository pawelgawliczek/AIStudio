/**
 * Tests for MetricsSummaryCard component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricsSummaryCard } from '../MetricsSummaryCard';

describe('MetricsSummaryCard', () => {
  it('should render title and value', () => {
    render(<MetricsSummaryCard title="Health Score" value="85" />);
    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('should render trend information when provided', () => {
    render(
      <MetricsSummaryCard
        title="Coverage"
        value="75%"
        trend={{ direction: 'improving', value: 5 }}
      />
    );
    expect(screen.getByText('+5.0%')).toBeInTheDocument();
  });

  it('should render info icon when infoText is provided', () => {
    const { container } = render(
      <MetricsSummaryCard title="Test" value="100" infoText="Additional info" />
    );
    // InfoIcon renders an SVG element
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
