/**
 * Tests for ChurnVsComplexityChart Component
 * Scatter plot showing relationship between churn and complexity
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChurnVsComplexityChart } from '../ChurnVsComplexityChart';
import { FileHotspot } from '../../../types/codeQualityTypes';

// Mock Recharts components
vi.mock('recharts', () => ({
  ScatterChart: ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: ({ data }: any) => (
    <div data-testid="scatter">
      {data.map((point: any, index: number) => (
        <div key={index} data-testid={`scatter-point-${index}`}>
          x:{point.x},y:{point.y},z:{point.z}
        </div>
      ))}
    </div>
  ),
  XAxis: ({ label }: any) => (
    <div data-testid="x-axis">
      {label && <span data-testid="x-axis-label">{label.value}</span>}
    </div>
  ),
  YAxis: ({ label }: any) => (
    <div data-testid="y-axis">
      {label && <span data-testid="y-axis-label">{label.value}</span>}
    </div>
  ),
  ZAxis: () => <div data-testid="z-axis">Z Axis</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid">Grid</div>,
  Tooltip: ({ content }: any) => (
    <div data-testid="tooltip">
      {content && <div data-testid="custom-tooltip">Custom Tooltip</div>}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" style={{ fill }} />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

const createMockHotspot = (overrides?: Partial<FileHotspot>): FileHotspot => ({
  filePath: 'src/test.ts',
  riskScore: 50,
  complexity: 10,
  churnCount: 20,
  coverage: 70,
  loc: 200,
  lastModified: new Date('2025-01-15'),
  criticalIssues: 0,
  ...overrides,
});

describe('ChurnVsComplexityChart', () => {
  describe('Basic rendering', () => {
    it('should render scatter chart with data', () => {
      const hotspots = [
        createMockHotspot({ churnCount: 10, complexity: 5, riskScore: 30 }),
        createMockHotspot({ churnCount: 20, complexity: 15, riskScore: 60 }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should render with empty hotspots array', () => {
      render(<ChurnVsComplexityChart hotspots={[]} />);

      expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
      expect(screen.getByTestId('scatter')).toBeInTheDocument();
    });

    it('should render axes', () => {
      const hotspots = [createMockHotspot()];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('z-axis')).toBeInTheDocument();
    });

    it('should render axis labels', () => {
      const hotspots = [createMockHotspot()];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('x-axis-label')).toHaveTextContent('Churn (commits)');
      expect(screen.getByTestId('y-axis-label')).toHaveTextContent('Complexity');
    });

    it('should render cartesian grid', () => {
      const hotspots = [createMockHotspot()];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    });

    it('should render tooltip', () => {
      const hotspots = [createMockHotspot()];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();
    });
  });

  describe('Data transformation', () => {
    it('should map churnCount to x-axis', () => {
      const hotspots = [createMockHotspot({ churnCount: 25 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/x:25/)).toBeInTheDocument();
    });

    it('should map complexity to y-axis', () => {
      const hotspots = [createMockHotspot({ complexity: 30 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/y:30/)).toBeInTheDocument();
    });

    it('should map riskScore to z-axis (bubble size)', () => {
      const hotspots = [createMockHotspot({ riskScore: 75.5 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/z:75.5/)).toBeInTheDocument();
    });

    it('should include filePath in data', () => {
      const hotspots = [
        createMockHotspot({ filePath: 'backend/src/auth/service.ts' }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      // FilePath is used in tooltip, not directly rendered in our mock
      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
    });

    it('should include LOC in data', () => {
      const hotspots = [createMockHotspot({ loc: 500 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
    });

    it('should handle multiple hotspots', () => {
      const hotspots = [
        createMockHotspot({ churnCount: 10, complexity: 5 }),
        createMockHotspot({ churnCount: 20, complexity: 15 }),
        createMockHotspot({ churnCount: 30, complexity: 25 }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
      expect(screen.getByTestId('scatter-point-1')).toBeInTheDocument();
      expect(screen.getByTestId('scatter-point-2')).toBeInTheDocument();
    });
  });

  describe('Color coding by risk score', () => {
    it('should use red for critical risk (score > 7)', () => {
      const hotspots = [createMockHotspot({ riskScore: 8.5 })];

      const { container } = render(<ChurnVsComplexityChart hotspots={hotspots} />);

      const cells = container.querySelectorAll('[data-testid="cell"]');
      expect(cells.length).toBeGreaterThan(0);
      expect((cells[0] as HTMLElement).style.fill).toBe('#ef4444');
    });

    it('should use orange for high risk (score > 5 and <= 7)', () => {
      const hotspots = [createMockHotspot({ riskScore: 6.5 })];

      const { container } = render(<ChurnVsComplexityChart hotspots={hotspots} />);

      const cells = container.querySelectorAll('[data-testid="cell"]');
      expect((cells[0] as HTMLElement).style.fill).toBe('#f97316');
    });

    it('should use yellow for medium risk (score > 3 and <= 5)', () => {
      const hotspots = [createMockHotspot({ riskScore: 4.5 })];

      const { container } = render(<ChurnVsComplexityChart hotspots={hotspots} />);

      const cells = container.querySelectorAll('[data-testid="cell"]');
      expect((cells[0] as HTMLElement).style.fill).toBe('#eab308');
    });

    it('should use green for low risk (score <= 3)', () => {
      const hotspots = [createMockHotspot({ riskScore: 2.5 })];

      const { container } = render(<ChurnVsComplexityChart hotspots={hotspots} />);

      const cells = container.querySelectorAll('[data-testid="cell"]');
      expect((cells[0] as HTMLElement).style.fill).toBe('#22c55e');
    });

    it('should handle risk score exactly at boundary (7.0)', () => {
      const hotspots = [createMockHotspot({ riskScore: 7.0 })];

      const { container } = render(<ChurnVsComplexityChart hotspots={hotspots} />);

      const cells = container.querySelectorAll('[data-testid="cell"]');
      expect((cells[0] as HTMLElement).style.fill).toBe('#f97316'); // 7.0 is not > 7, so orange
    });

    it('should handle risk score exactly at boundary (5.0)', () => {
      const hotspots = [createMockHotspot({ riskScore: 5.0 })];

      const { container } = render(<ChurnVsComplexityChart hotspots={hotspots} />);

      const cells = container.querySelectorAll('[data-testid="cell"]');
      expect((cells[0] as HTMLElement).style.fill).toBe('#eab308'); // 5.0 is not > 5, so yellow
    });

    it('should handle risk score exactly at boundary (3.0)', () => {
      const hotspots = [createMockHotspot({ riskScore: 3.0 })];

      const { container } = render(<ChurnVsComplexityChart hotspots={hotspots} />);

      const cells = container.querySelectorAll('[data-testid="cell"]');
      expect((cells[0] as HTMLElement).style.fill).toBe('#22c55e'); // 3.0 is not > 3, so green
    });
  });

  describe('Edge cases: Null and undefined values', () => {
    it('should handle null churnCount as 0', () => {
      const hotspots = [createMockHotspot({ churnCount: null as any })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/x:0/)).toBeInTheDocument();
    });

    it('should handle undefined churnCount as 0', () => {
      const hotspots = [createMockHotspot({ churnCount: undefined as any })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/x:0/)).toBeInTheDocument();
    });

    it('should handle null complexity as 0', () => {
      const hotspots = [createMockHotspot({ complexity: null as any })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/y:0/)).toBeInTheDocument();
    });

    it('should handle undefined complexity as 0', () => {
      const hotspots = [createMockHotspot({ complexity: undefined as any })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/y:0/)).toBeInTheDocument();
    });

    it('should handle null riskScore as 0', () => {
      const hotspots = [createMockHotspot({ riskScore: null as any })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/z:0/)).toBeInTheDocument();
    });

    it('should handle null loc as 0', () => {
      const hotspots = [createMockHotspot({ loc: null as any })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
    });
  });

  describe('Edge cases: All same values', () => {
    it('should handle all hotspots with same churn', () => {
      const hotspots = [
        createMockHotspot({ churnCount: 20, complexity: 10, riskScore: 30 }),
        createMockHotspot({ churnCount: 20, complexity: 15, riskScore: 40 }),
        createMockHotspot({ churnCount: 20, complexity: 25, riskScore: 50 }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getAllByText(/x:20/).length).toBe(3);
    });

    it('should handle all hotspots with same complexity', () => {
      const hotspots = [
        createMockHotspot({ churnCount: 10, complexity: 15, riskScore: 30 }),
        createMockHotspot({ churnCount: 20, complexity: 15, riskScore: 40 }),
        createMockHotspot({ churnCount: 30, complexity: 15, riskScore: 50 }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getAllByText(/y:15/).length).toBe(3);
    });

    it('should handle all hotspots with identical values', () => {
      const hotspots = [
        createMockHotspot({ churnCount: 20, complexity: 15, riskScore: 50 }),
        createMockHotspot({ churnCount: 20, complexity: 15, riskScore: 50 }),
        createMockHotspot({ churnCount: 20, complexity: 15, riskScore: 50 }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
      expect(screen.getByTestId('scatter-point-1')).toBeInTheDocument();
      expect(screen.getByTestId('scatter-point-2')).toBeInTheDocument();
    });
  });

  describe('Edge cases: Extreme outliers', () => {
    it('should handle extremely high churn', () => {
      const hotspots = [createMockHotspot({ churnCount: 10000 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/x:10000/)).toBeInTheDocument();
    });

    it('should handle extremely high complexity', () => {
      const hotspots = [createMockHotspot({ complexity: 500 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/y:500/)).toBeInTheDocument();
    });

    it('should handle extremely high risk score', () => {
      const hotspots = [createMockHotspot({ riskScore: 99.9 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/z:99.9/)).toBeInTheDocument();
    });

    it('should handle zero values', () => {
      const hotspots = [
        createMockHotspot({ churnCount: 0, complexity: 0, riskScore: 0 }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/x:0,y:0,z:0/)).toBeInTheDocument();
    });

    it('should handle mix of extreme and normal values', () => {
      const hotspots = [
        createMockHotspot({ churnCount: 1, complexity: 1, riskScore: 1 }),
        createMockHotspot({ churnCount: 1000, complexity: 100, riskScore: 95 }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
      expect(screen.getByTestId('scatter-point-1')).toBeInTheDocument();
    });
  });

  describe('Large datasets', () => {
    it('should handle 100 hotspots', () => {
      const hotspots = Array.from({ length: 100 }, (_, i) =>
        createMockHotspot({
          filePath: `file-${i}.ts`,
          churnCount: i,
          complexity: i * 2,
          riskScore: (i % 10) + 1,
        })
      );

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter')).toBeInTheDocument();
      expect(screen.getAllByTestId(/scatter-point-/).length).toBe(100);
    });

    it('should handle single hotspot', () => {
      const hotspots = [createMockHotspot()];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
    });
  });

  describe('Decimal values', () => {
    it('should handle decimal churn values', () => {
      const hotspots = [createMockHotspot({ churnCount: 25.5 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/x:25.5/)).toBeInTheDocument();
    });

    it('should handle decimal complexity values', () => {
      const hotspots = [createMockHotspot({ complexity: 15.7 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/y:15.7/)).toBeInTheDocument();
    });

    it('should handle decimal risk scores', () => {
      const hotspots = [createMockHotspot({ riskScore: 6.85 })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByText(/z:6.85/)).toBeInTheDocument();
    });
  });

  describe('File path handling', () => {
    it('should handle short file paths', () => {
      const hotspots = [createMockHotspot({ filePath: 'a.ts' })];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
    });

    it('should handle long file paths', () => {
      const hotspots = [
        createMockHotspot({
          filePath: 'backend/src/very/long/path/to/deeply/nested/file/structure.ts',
        }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
    });

    it('should handle special characters in file paths', () => {
      const hotspots = [
        createMockHotspot({ filePath: 'src/file-with-dash_and_underscore.ts' }),
      ];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('scatter-point-0')).toBeInTheDocument();
    });
  });

  describe('Responsive container', () => {
    it('should use ResponsiveContainer for proper sizing', () => {
      const hotspots = [createMockHotspot()];

      render(<ChurnVsComplexityChart hotspots={hotspots} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
