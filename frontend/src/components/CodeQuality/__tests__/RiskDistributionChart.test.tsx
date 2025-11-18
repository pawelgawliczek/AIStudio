/**
 * Tests for RiskDistributionChart Component
 * Pie chart component showing risk distribution across files
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskDistributionChart } from '../RiskDistributionChart';

// Mock Recharts to avoid canvas rendering issues in tests
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, label }: any) => (
    <div data-testid="pie">
      {data.map((item: any, index: number) => (
        <div key={index} data-testid={`pie-segment-${item.name}`}>
          {item.name}: {item.value}
        </div>
      ))}
      {label && <div data-testid="custom-label">Custom Label</div>}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" style={{ fill }} />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Legend: () => <div data-testid="legend">Legend</div>,
  Tooltip: () => <div data-testid="tooltip">Tooltip</div>,
}));

describe('RiskDistributionChart', () => {
  describe('Rendering with all risk levels', () => {
    it('should render pie chart with all four risk levels', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should display critical risk segment', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('pie-segment-Critical')).toBeInTheDocument();
      expect(screen.getByText('Critical: 5')).toBeInTheDocument();
    });

    it('should display high risk segment', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('pie-segment-High')).toBeInTheDocument();
      expect(screen.getByText('High: 10')).toBeInTheDocument();
    });

    it('should display medium risk segment', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('pie-segment-Medium')).toBeInTheDocument();
      expect(screen.getByText('Medium: 15')).toBeInTheDocument();
    });

    it('should display low risk segment', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('pie-segment-Low')).toBeInTheDocument();
      expect(screen.getByText('Low: 20')).toBeInTheDocument();
    });

    it('should render legend', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('should render tooltip', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('Filtering zero-value segments', () => {
    it('should not display critical segment when value is 0', () => {
      render(<RiskDistributionChart critical={0} high={10} medium={15} low={20} />);

      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
    });

    it('should not display high segment when value is 0', () => {
      render(<RiskDistributionChart critical={5} high={0} medium={15} low={20} />);

      expect(screen.queryByTestId('pie-segment-High')).not.toBeInTheDocument();
    });

    it('should not display medium segment when value is 0', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={0} low={20} />);

      expect(screen.queryByTestId('pie-segment-Medium')).not.toBeInTheDocument();
    });

    it('should not display low segment when value is 0', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={0} />);

      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });

    it('should only show segments with non-zero values', () => {
      render(<RiskDistributionChart critical={5} high={0} medium={15} low={0} />);

      expect(screen.getByTestId('pie-segment-Critical')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-High')).not.toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-Medium')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });
  });

  describe('Edge case: All zeros', () => {
    it('should render chart even with all zeros', () => {
      render(<RiskDistributionChart critical={0} high={0} medium={0} low={0} />);

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('should have no segments when all values are zero', () => {
      render(<RiskDistributionChart critical={0} high={0} medium={0} low={0} />);

      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-High')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Medium')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });
  });

  describe('Edge case: Only one risk level has data', () => {
    it('should show only critical when others are zero', () => {
      render(<RiskDistributionChart critical={10} high={0} medium={0} low={0} />);

      expect(screen.getByTestId('pie-segment-Critical')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-High')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Medium')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });

    it('should show only high when others are zero', () => {
      render(<RiskDistributionChart critical={0} high={25} medium={0} low={0} />);

      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-High')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Medium')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });

    it('should show only medium when others are zero', () => {
      render(<RiskDistributionChart critical={0} high={0} medium={30} low={0} />);

      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-High')).not.toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-Medium')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });

    it('should show only low when others are zero', () => {
      render(<RiskDistributionChart critical={0} high={0} medium={0} low={40} />);

      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-High')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Medium')).not.toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-Low')).toBeInTheDocument();
    });
  });

  describe('Color coding', () => {
    it('should use correct colors for each risk level', () => {
      const { container } = render(
        <RiskDistributionChart critical={5} high={10} medium={15} low={20} />
      );

      const cells = container.querySelectorAll('[data-testid="cell"]');

      // Check that we have 4 cells (one for each non-zero segment)
      expect(cells.length).toBe(4);

      // Colors are defined in the component:
      // Critical: #ef4444, High: #f97316, Medium: #eab308, Low: #22c55e
      const styles = Array.from(cells).map(cell => (cell as HTMLElement).style.fill);
      expect(styles).toContain('#ef4444'); // Critical - Red
      expect(styles).toContain('#f97316'); // High - Orange
      expect(styles).toContain('#eab308'); // Medium - Yellow
      expect(styles).toContain('#22c55e'); // Low - Green
    });
  });

  describe('Large numbers', () => {
    it('should handle large numbers correctly', () => {
      render(<RiskDistributionChart critical={1000} high={2000} medium={3000} low={4000} />);

      expect(screen.getByText('Critical: 1000')).toBeInTheDocument();
      expect(screen.getByText('High: 2000')).toBeInTheDocument();
      expect(screen.getByText('Medium: 3000')).toBeInTheDocument();
      expect(screen.getByText('Low: 4000')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      render(<RiskDistributionChart critical={10000} high={20000} medium={30000} low={40000} />);

      expect(screen.getByText('Critical: 10000')).toBeInTheDocument();
      expect(screen.getByText('High: 20000')).toBeInTheDocument();
      expect(screen.getByText('Medium: 30000')).toBeInTheDocument();
      expect(screen.getByText('Low: 40000')).toBeInTheDocument();
    });
  });

  describe('Small distributions', () => {
    it('should handle single file in each category', () => {
      render(<RiskDistributionChart critical={1} high={1} medium={1} low={1} />);

      expect(screen.getByText('Critical: 1')).toBeInTheDocument();
      expect(screen.getByText('High: 1')).toBeInTheDocument();
      expect(screen.getByText('Medium: 1')).toBeInTheDocument();
      expect(screen.getByText('Low: 1')).toBeInTheDocument();
    });

    it('should handle uneven distribution', () => {
      render(<RiskDistributionChart critical={1} high={2} medium={97} low={0} />);

      expect(screen.getByTestId('pie-segment-Critical')).toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-High')).toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-Medium')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });
  });

  describe('Component structure', () => {
    it('should use ResponsiveContainer for responsive sizing', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should have custom label function for percentages', () => {
      render(<RiskDistributionChart critical={5} high={10} medium={15} low={20} />);

      // Custom label is rendered when present
      expect(screen.getByTestId('custom-label')).toBeInTheDocument();
    });
  });

  describe('Segment ordering', () => {
    it('should maintain consistent segment order (Critical, High, Medium, Low)', () => {
      const { container } = render(
        <RiskDistributionChart critical={5} high={10} medium={15} low={20} />
      );

      const segments = container.querySelectorAll('[data-testid^="pie-segment-"]');
      const segmentNames = Array.from(segments).map(seg =>
        seg.getAttribute('data-testid')?.replace('pie-segment-', '')
      );

      expect(segmentNames).toEqual(['Critical', 'High', 'Medium', 'Low']);
    });

    it('should maintain order even when some segments are missing', () => {
      const { container } = render(
        <RiskDistributionChart critical={5} high={0} medium={15} low={0} />
      );

      const segments = container.querySelectorAll('[data-testid^="pie-segment-"]');
      const segmentNames = Array.from(segments).map(seg =>
        seg.getAttribute('data-testid')?.replace('pie-segment-', '')
      );

      expect(segmentNames).toEqual(['Critical', 'Medium']);
    });
  });

  describe('Negative values handling', () => {
    // Although negative values don't make sense for file counts,
    // we should ensure the component doesn't break
    it('should filter out negative values', () => {
      render(<RiskDistributionChart critical={-5} high={10} medium={15} low={20} />);

      // Negative values should be filtered out (< 0 is not > 0)
      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-High')).toBeInTheDocument();
    });

    it('should handle all negative values', () => {
      render(<RiskDistributionChart critical={-5} high={-10} medium={-15} low={-20} />);

      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-High')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Medium')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Low')).not.toBeInTheDocument();
    });
  });

  describe('Decimal values handling', () => {
    it('should handle decimal values', () => {
      render(<RiskDistributionChart critical={5.5} high={10.7} medium={15.2} low={20.9} />);

      expect(screen.getByText('Critical: 5.5')).toBeInTheDocument();
      expect(screen.getByText('High: 10.7')).toBeInTheDocument();
      expect(screen.getByText('Medium: 15.2')).toBeInTheDocument();
      expect(screen.getByText('Low: 20.9')).toBeInTheDocument();
    });

    it('should filter out zero decimals', () => {
      render(<RiskDistributionChart critical={0.0} high={10.5} medium={0} low={20.1} />);

      expect(screen.queryByTestId('pie-segment-Critical')).not.toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-High')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-segment-Medium')).not.toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-Low')).toBeInTheDocument();
    });
  });
});
