/**
 * Tests for TrendChart Component
 * Reusable line chart component for displaying trends
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart } from '../TrendChart';

// Mock Recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-point-count={data.length}>
      {children}
    </div>
  ),
  Line: ({ dataKey, stroke, strokeWidth, name }: any) => (
    <div data-testid="line" data-key={dataKey} data-color={stroke} data-width={strokeWidth}>
      {name}
    </div>
  ),
  XAxis: ({ dataKey, tickFormatter }: any) => (
    <div data-testid="x-axis" data-key={dataKey}>
      {tickFormatter && <span data-testid="x-formatter">Has formatter</span>}
    </div>
  ),
  YAxis: () => <div data-testid="y-axis">Y Axis</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid">Grid</div>,
  Tooltip: ({ labelFormatter }: any) => (
    <div data-testid="tooltip">
      {labelFormatter && <span data-testid="tooltip-formatter">Has formatter</span>}
    </div>
  ),
  Legend: () => <div data-testid="legend">Legend</div>,
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  ),
}));

const mockData = [
  { date: '2025-01-01', value: 10 },
  { date: '2025-01-02', value: 15 },
  { date: '2025-01-03', value: 12 },
];

describe('TrendChart', () => {
  describe('Basic rendering', () => {
    it('should render chart with title', () => {
      render(<TrendChart title="Health Score" data={mockData} />);

      expect(screen.getByText('Health Score')).toBeInTheDocument();
    });

    it('should render chart with subtitle when provided', () => {
      render(
        <TrendChart title="Health Score" subtitle="Last 30 days" data={mockData} />
      );

      expect(screen.getByText('Health Score')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('should not render subtitle when not provided', () => {
      render(<TrendChart title="Health Score" data={mockData} />);

      expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument();
    });

    it('should render line chart', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should render axes', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });

    it('should render cartesian grid', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    });

    it('should render tooltip', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('should render legend', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('should render line', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('line')).toBeInTheDocument();
    });
  });

  describe('Data handling', () => {
    it('should pass data to chart', () => {
      render(<TrendChart title="Test" data={mockData} />);

      const chart = screen.getByTestId('line-chart');
      expect(chart.getAttribute('data-point-count')).toBe('3');
    });

    it('should handle empty data array', () => {
      render(<TrendChart title="Test" data={[]} />);

      const chart = screen.getByTestId('line-chart');
      expect(chart.getAttribute('data-point-count')).toBe('0');
    });

    it('should handle single data point', () => {
      const singlePoint = [{ date: '2025-01-01', value: 10 }];

      render(<TrendChart title="Test" data={singlePoint} />);

      const chart = screen.getByTestId('line-chart');
      expect(chart.getAttribute('data-point-count')).toBe('1');
    });

    it('should handle large dataset', () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        value: Math.random() * 100,
      }));

      render(<TrendChart title="Test" data={largeData} />);

      const chart = screen.getByTestId('line-chart');
      expect(chart.getAttribute('data-point-count')).toBe('100');
    });
  });

  describe('DataKey prop', () => {
    it('should use default dataKey "value"', () => {
      render(<TrendChart title="Test" data={mockData} />);

      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-key')).toBe('value');
    });

    it('should use custom dataKey when provided', () => {
      const customData = [
        { date: '2025-01-01', score: 10 },
        { date: '2025-01-02', score: 15 },
      ];

      render(<TrendChart title="Test" data={customData} dataKey="score" />);

      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-key')).toBe('score');
    });
  });

  describe('Height prop', () => {
    it('should use default height 256px', () => {
      const { container } = render(<TrendChart title="Test" data={mockData} />);

      const wrapper = container.querySelector('[style*="height"]');
      expect(wrapper).toHaveStyle({ height: '256px' });
    });

    it('should use custom height when provided', () => {
      const { container } = render(
        <TrendChart title="Test" data={mockData} height={400} />
      );

      const wrapper = container.querySelector('[style*="height"]');
      expect(wrapper).toHaveStyle({ height: '400px' });
    });

    it('should handle very small height', () => {
      const { container } = render(
        <TrendChart title="Test" data={mockData} height={50} />
      );

      const wrapper = container.querySelector('[style*="height"]');
      expect(wrapper).toHaveStyle({ height: '50px' });
    });

    it('should handle very large height', () => {
      const { container } = render(
        <TrendChart title="Test" data={mockData} height={1000} />
      );

      const wrapper = container.querySelector('[style*="height"]');
      expect(wrapper).toHaveStyle({ height: '1000px' });
    });
  });

  describe('Color prop', () => {
    it('should use default color #135bec', () => {
      render(<TrendChart title="Test" data={mockData} />);

      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-color')).toBe('#135bec');
    });

    it('should use custom color when provided', () => {
      render(<TrendChart title="Test" data={mockData} color="#ff0000" />);

      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-color')).toBe('#ff0000');
    });

    it('should handle named colors', () => {
      render(<TrendChart title="Test" data={mockData} color="red" />);

      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-color')).toBe('red');
    });

    it('should handle rgb colors', () => {
      render(<TrendChart title="Test" data={mockData} color="rgb(255, 0, 0)" />);

      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-color')).toBe('rgb(255, 0, 0)');
    });
  });

  describe('X-axis formatting', () => {
    it('should have date formatter for x-axis', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('x-formatter')).toBeInTheDocument();
    });

    it('should use date as dataKey for x-axis', () => {
      render(<TrendChart title="Test" data={mockData} />);

      const xAxis = screen.getByTestId('x-axis');
      expect(xAxis.getAttribute('data-key')).toBe('date');
    });
  });

  describe('Tooltip formatting', () => {
    it('should have label formatter for tooltip', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('tooltip-formatter')).toBeInTheDocument();
    });
  });

  describe('Line configuration', () => {
    it('should set line name to title', () => {
      render(<TrendChart title="Health Score" data={mockData} />);

      const line = screen.getByTestId('line');
      expect(line).toHaveTextContent('Health Score');
    });

    it('should have stroke width of 3', () => {
      render(<TrendChart title="Test" data={mockData} />);

      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-width')).toBe('3');
    });
  });

  describe('Responsive container', () => {
    it('should use ResponsiveContainer', () => {
      render(<TrendChart title="Test" data={mockData} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should set width to 100%', () => {
      render(<TrendChart title="Test" data={mockData} />);

      const container = screen.getByTestId('responsive-container');
      expect(container.getAttribute('data-width')).toBe('100%');
    });

    it('should set height to 100%', () => {
      render(<TrendChart title="Test" data={mockData} />);

      const container = screen.getByTestId('responsive-container');
      expect(container.getAttribute('data-height')).toBe('100%');
    });
  });

  describe('Styling', () => {
    it('should have border and background', () => {
      const { container } = render(<TrendChart title="Test" data={mockData} />);

      const wrapper = container.querySelector('.rounded-xl');
      expect(wrapper).toHaveClass('border');
      expect(wrapper).toHaveClass('bg-white');
      expect(wrapper).toHaveClass('dark:bg-gray-800');
    });

    it('should have padding', () => {
      const { container } = render(<TrendChart title="Test" data={mockData} />);

      const wrapper = container.querySelector('.rounded-xl');
      expect(wrapper).toHaveClass('p-6');
    });

    it('should style title correctly', () => {
      const { container } = render(<TrendChart title="Test" data={mockData} />);

      const title = container.querySelector('.font-semibold');
      expect(title).toHaveClass('text-gray-900');
      expect(title).toHaveClass('dark:text-white');
    });

    it('should style subtitle correctly when present', () => {
      const { container } = render(
        <TrendChart title="Test" subtitle="Subtitle" data={mockData} />
      );

      const subtitle = container.querySelector('.text-sm');
      expect(subtitle).toHaveClass('text-gray-500');
      expect(subtitle).toHaveClass('dark:text-gray-400');
    });
  });

  describe('Edge cases with data', () => {
    it('should handle data with additional properties', () => {
      const dataWithExtra = [
        { date: '2025-01-01', value: 10, extra: 'test', another: 100 },
        { date: '2025-01-02', value: 15, extra: 'test2', another: 200 },
      ];

      render(<TrendChart title="Test" data={dataWithExtra} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle dates in different formats', () => {
      const differentDates = [
        { date: '2025-01-01T10:00:00Z', value: 10 },
        { date: '2025-01-02', value: 15 },
        { date: '01/03/2025', value: 12 },
      ];

      render(<TrendChart title="Test" data={differentDates} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle zero values', () => {
      const zeroData = [
        { date: '2025-01-01', value: 0 },
        { date: '2025-01-02', value: 0 },
      ];

      render(<TrendChart title="Test" data={zeroData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle negative values', () => {
      const negativeData = [
        { date: '2025-01-01', value: -10 },
        { date: '2025-01-02', value: 15 },
        { date: '2025-01-03', value: -5 },
      ];

      render(<TrendChart title="Test" data={negativeData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle very large values', () => {
      const largeData = [
        { date: '2025-01-01', value: 1000000 },
        { date: '2025-01-02', value: 2000000 },
      ];

      render(<TrendChart title="Test" data={largeData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle decimal values', () => {
      const decimalData = [
        { date: '2025-01-01', value: 10.5 },
        { date: '2025-01-02', value: 15.75 },
      ];

      render(<TrendChart title="Test" data={decimalData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Title and subtitle edge cases', () => {
    it('should handle very long title', () => {
      const longTitle = 'A'.repeat(200);

      render(<TrendChart title={longTitle} data={mockData} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle very long subtitle', () => {
      const longSubtitle = 'B'.repeat(200);

      render(
        <TrendChart title="Test" subtitle={longSubtitle} data={mockData} />
      );

      expect(screen.getByText(longSubtitle)).toBeInTheDocument();
    });

    it('should handle empty string title', () => {
      render(<TrendChart title="" data={mockData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle special characters in title', () => {
      render(
        <TrendChart title={'Test <>&"\''} data={mockData} />
      );

      expect(screen.getByText('Test <>&"\'')).toBeInTheDocument();
    });
  });

  describe('Integration with use case', () => {
    it('should work as churn trend chart in HotspotDetailsPanel', () => {
      const churnData = [
        { date: '2025-01-13', value: 125 },
        { date: '2025-01-14', value: 75 },
        { date: '2025-01-15', value: 50 },
      ];

      render(
        <TrendChart
          title=""
          subtitle=""
          data={churnData}
          dataKey="value"
          height={150}
          color="#ef4444"
        />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      const line = screen.getByTestId('line');
      expect(line.getAttribute('data-color')).toBe('#ef4444');
    });

    it('should work with health score data', () => {
      const healthData = [
        { date: '2025-01-01', value: 75 },
        { date: '2025-01-02', value: 78 },
        { date: '2025-01-03', value: 80 },
      ];

      render(
        <TrendChart
          title="Health Score"
          subtitle="Last 7 days"
          data={healthData}
        />
      );

      expect(screen.getByText('Health Score')).toBeInTheDocument();
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });
  });
});
