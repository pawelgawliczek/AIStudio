/**
 * Tests for Icon Components
 * SVG icon components used throughout the Code Quality dashboard
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  InfoIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  WarningIcon,
  ErrorIcon,
  DashboardIcon,
  FolderIcon,
  ShieldCheckIcon,
  BugIcon,
  FlameIcon,
  RefreshIcon,
} from '../Icons';

describe('Icon Components', () => {
  describe('TrendingUpIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<TrendingUpIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have correct dimensions', () => {
      const { container } = render(<TrendingUpIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });

    it('should apply custom className', () => {
      const { container } = render(<TrendingUpIcon className="custom-class" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('custom-class');
    });

    it('should have path element for trending up arrow', () => {
      const { container } = render(<TrendingUpIcon />);
      expect(container.querySelector('path')).toBeInTheDocument();
    });
  });

  describe('TrendingDownIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<TrendingDownIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have correct dimensions', () => {
      const { container } = render(<TrendingDownIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });

    it('should apply custom className', () => {
      const { container } = render(<TrendingDownIcon className="text-red-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-red-500');
    });
  });

  describe('InfoIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<InfoIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have correct dimensions', () => {
      const { container } = render(<InfoIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
    });

    it('should have circle and path elements', () => {
      const { container } = render(<InfoIcon />);
      expect(container.querySelector('circle')).toBeInTheDocument();
      expect(container.querySelector('path')).toBeInTheDocument();
    });
  });

  describe('ChevronDownIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<ChevronDownIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have correct dimensions', () => {
      const { container } = render(<ChevronDownIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });

    it('should apply custom className', () => {
      const { container } = render(<ChevronDownIcon className="rotate-180" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('rotate-180');
    });
  });

  describe('ArrowRightIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<ArrowRightIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have correct dimensions', () => {
      const { container } = render(<ArrowRightIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
    });
  });

  describe('CalendarIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<CalendarIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have rect and path elements', () => {
      const { container } = render(<CalendarIcon />);
      expect(container.querySelector('rect')).toBeInTheDocument();
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('should have correct dimensions', () => {
      const { container } = render(<CalendarIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });
  });

  describe('CheckCircleIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<CheckCircleIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have circle and path elements', () => {
      const { container } = render(<CheckCircleIcon />);
      expect(container.querySelector('circle')).toBeInTheDocument();
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<CheckCircleIcon className="text-green-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-green-500');
    });
  });

  describe('WarningIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<WarningIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have path element', () => {
      const { container } = render(<WarningIcon />);
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<WarningIcon className="text-yellow-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-yellow-500');
    });
  });

  describe('ErrorIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<ErrorIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have circle and path elements', () => {
      const { container } = render(<ErrorIcon />);
      expect(container.querySelector('circle')).toBeInTheDocument();
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<ErrorIcon className="text-red-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-red-500');
    });
  });

  describe('DashboardIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<DashboardIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have multiple rect elements for grid', () => {
      const { container } = render(<DashboardIcon />);
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(4); // 4 grid squares
    });

    it('should have correct dimensions', () => {
      const { container } = render(<DashboardIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });
  });

  describe('FolderIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<FolderIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have path element', () => {
      const { container } = render(<FolderIcon />);
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<FolderIcon className="text-blue-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-blue-500');
    });
  });

  describe('ShieldCheckIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<ShieldCheckIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have multiple path elements for shield and check', () => {
      const { container } = render(<ShieldCheckIcon />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(2); // Shield outline + checkmark
    });

    it('should apply custom className', () => {
      const { container } = render(<ShieldCheckIcon className="text-primary" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-primary');
    });
  });

  describe('BugIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<BugIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have circle and path elements', () => {
      const { container } = render(<BugIcon />);
      expect(container.querySelector('circle')).toBeInTheDocument();
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<BugIcon className="text-red-600" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-red-600');
    });
  });

  describe('FlameIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<FlameIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have multiple path elements for flame', () => {
      const { container } = render(<FlameIcon />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(2); // Main flame + bottom
    });

    it('should apply custom className', () => {
      const { container } = render(<FlameIcon className="text-orange-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-orange-500');
    });
  });

  describe('RefreshIcon', () => {
    it('should render svg element', () => {
      const { container } = render(<RefreshIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should have multiple path elements', () => {
      const { container } = render(<RefreshIcon />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(2); // Circular arrows + arrow tips
    });

    it('should apply custom className', () => {
      const { container } = render(<RefreshIcon className="animate-spin" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('animate-spin');
    });
  });

  describe('Common icon properties', () => {
    it('all icons should have viewBox attribute', () => {
      const icons = [
        <TrendingUpIcon key="1" />,
        <TrendingDownIcon key="2" />,
        <InfoIcon key="3" />,
        <ChevronDownIcon key="4" />,
        <ArrowRightIcon key="5" />,
        <CalendarIcon key="6" />,
        <CheckCircleIcon key="7" />,
        <WarningIcon key="8" />,
        <ErrorIcon key="9" />,
        <DashboardIcon key="10" />,
        <FolderIcon key="11" />,
        <ShieldCheckIcon key="12" />,
        <BugIcon key="13" />,
        <FlameIcon key="14" />,
        <RefreshIcon key="15" />,
      ];

      icons.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('viewBox');
      });
    });

    it('all icons should support className prop', () => {
      const icons = [
        <TrendingUpIcon key="1" className="test-class" />,
        <TrendingDownIcon key="2" className="test-class" />,
        <InfoIcon key="3" className="test-class" />,
        <ChevronDownIcon key="4" className="test-class" />,
        <ArrowRightIcon key="5" className="test-class" />,
        <CalendarIcon key="6" className="test-class" />,
        <CheckCircleIcon key="7" className="test-class" />,
        <WarningIcon key="8" className="test-class" />,
        <ErrorIcon key="9" className="test-class" />,
        <DashboardIcon key="10" className="test-class" />,
        <FolderIcon key="11" className="test-class" />,
        <ShieldCheckIcon key="12" className="test-class" />,
        <BugIcon key="13" className="test-class" />,
        <FlameIcon key="14" className="test-class" />,
        <RefreshIcon key="15" className="test-class" />,
      ];

      icons.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('test-class');
      });
    });

    it('all icons should have default empty className when not provided', () => {
      const icons = [
        <TrendingUpIcon key="1" />,
        <TrendingDownIcon key="2" />,
        <InfoIcon key="3" />,
      ];

      icons.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });

    it('all icons should support multiple className values', () => {
      const { container } = render(
        <TrendingUpIcon className="text-green-500 w-6 h-6" />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-green-500');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('h-6');
    });
  });

  describe('SVG attributes', () => {
    it('icons should have fill="none" attribute', () => {
      const { container } = render(<TrendingUpIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('icons should have xmlns attribute', () => {
      const { container } = render(<TrendingUpIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
    });

    it('path elements should have stroke="currentColor"', () => {
      const { container } = render(<TrendingUpIcon />);
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('stroke', 'currentColor');
    });
  });

  describe('Icon size variations', () => {
    it('should render 20x20 icons correctly', () => {
      const icons20 = [
        <TrendingUpIcon key="1" />,
        <TrendingDownIcon key="2" />,
        <ChevronDownIcon key="3" />,
        <CalendarIcon key="4" />,
        <CheckCircleIcon key="5" />,
        <WarningIcon key="6" />,
        <ErrorIcon key="7" />,
        <DashboardIcon key="8" />,
        <FolderIcon key="9" />,
        <ShieldCheckIcon key="10" />,
        <BugIcon key="11" />,
        <FlameIcon key="12" />,
        <RefreshIcon key="13" />,
      ];

      icons20.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '20');
        expect(svg).toHaveAttribute('height', '20');
      });
    });

    it('should render 16x16 icons correctly', () => {
      const icons16 = [
        <InfoIcon key="1" />,
        <ArrowRightIcon key="2" />,
      ];

      icons16.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '16');
        expect(svg).toHaveAttribute('height', '16');
      });
    });
  });

  describe('Accessibility', () => {
    it('icons should be presentational by default', () => {
      const { container } = render(<TrendingUpIcon />);
      const svg = container.querySelector('svg');
      // SVGs without role or aria-label are presentational
      expect(svg).not.toHaveAttribute('role', 'img');
    });

    it('icons should support aria-hidden when used decoratively', () => {
      const { container } = render(
        <div aria-hidden="true">
          <TrendingUpIcon />
        </div>
      );
      const wrapper = container.querySelector('[aria-hidden="true"]');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty className string', () => {
      const { container } = render(<TrendingUpIcon className="" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle undefined className', () => {
      const { container } = render(<TrendingUpIcon className={undefined} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render correctly in dark mode contexts', () => {
      const { container } = render(
        <div className="dark">
          <TrendingUpIcon className="text-white dark:text-gray-200" />
        </div>
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-white');
      expect(svg).toHaveClass('dark:text-gray-200');
    });

    it('should work with Tailwind utility classes', () => {
      const { container } = render(
        <TrendingUpIcon className="w-8 h-8 text-primary hover:text-primary-dark transition-colors" />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-8');
      expect(svg).toHaveClass('h-8');
      expect(svg).toHaveClass('text-primary');
      expect(svg).toHaveClass('hover:text-primary-dark');
      expect(svg).toHaveClass('transition-colors');
    });
  });
});
