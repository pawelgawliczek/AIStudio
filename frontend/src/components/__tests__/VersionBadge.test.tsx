import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionBadge } from '../VersionBadge';

describe('VersionBadge', () => {
  describe('Rendering Tests', () => {
    it('renders version in correct format', () => {
      render(<VersionBadge version="v1.5" />);
      expect(screen.getByText('v1.5')).toBeInTheDocument();
    });

    it('applies active status colors', () => {
      render(<VersionBadge version="v1.5" status="active" />);
      const badge = screen.getByText('v1.5');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
      expect(badge).toHaveClass('dark:bg-green-900', 'dark:text-green-200');
    });

    it('applies inactive status colors', () => {
      render(<VersionBadge version="v1.5" status="inactive" />);
      const badge = screen.getByText('v1.5');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
      expect(badge).toHaveClass('dark:bg-gray-700', 'dark:text-gray-200');
    });

    it('applies major version colors', () => {
      render(<VersionBadge version="v2.0" status="major" />);
      const badge = screen.getByText('v2.0');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
      expect(badge).toHaveClass('dark:bg-blue-900', 'dark:text-blue-200');
    });

    it('defaults to active status when not specified', () => {
      render(<VersionBadge version="v1.0" />);
      const badge = screen.getByText('v1.0');
      expect(badge).toHaveClass('bg-green-100');
    });
  });

  describe('Size Variant Tests', () => {
    it('renders small size correctly', () => {
      render(<VersionBadge version="v1.5" size="sm" />);
      const badge = screen.getByText('v1.5');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('renders medium size correctly', () => {
      render(<VersionBadge version="v1.5" size="md" />);
      const badge = screen.getByText('v1.5');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-sm');
    });

    it('renders large size correctly', () => {
      render(<VersionBadge version="v1.5" size="lg" />);
      const badge = screen.getByText('v1.5');
      expect(badge).toHaveClass('px-3', 'py-1.5', 'text-base');
    });

    it('defaults to medium size when not specified', () => {
      render(<VersionBadge version="v1.0" />);
      const badge = screen.getByText('v1.0');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-sm');
    });
  });

  describe('Interaction Tests', () => {
    it('triggers onClick when clickable badge is clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<VersionBadge version="v1.5" onClick={handleClick} />);
      const badge = screen.getByRole('button');

      await user.click(badge);
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith('v1.5');
    });

    it('does not trigger onClick when not provided', async () => {
      const user = userEvent.setup();

      render(<VersionBadge version="v1.5" />);
      const badge = screen.getByText('v1.5');

      // Should not throw error when clicking non-interactive badge
      await user.click(badge);
      expect(badge).not.toHaveAttribute('role', 'button');
    });

    it('triggers onClick on Enter key press', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<VersionBadge version="v1.5" onClick={handleClick} />);
      const badge = screen.getByRole('button');

      badge.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith('v1.5');
    });

    it('triggers onClick on Space key press', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<VersionBadge version="v1.5" onClick={handleClick} />);
      const badge = screen.getByRole('button');

      badge.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith('v1.5');
    });

    it('applies interactive classes when onClick provided', () => {
      render(<VersionBadge version="v1.5" onClick={vi.fn()} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveClass('cursor-pointer', 'hover:opacity-80');
    });

    it('does not apply interactive classes when onClick not provided', () => {
      render(<VersionBadge version="v1.5" />);
      const badge = screen.getByText('v1.5');
      expect(badge).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Accessibility Tests', () => {
    it('has correct default ARIA label', () => {
      render(<VersionBadge version="v1.5" status="active" />);
      const badge = screen.getByLabelText('active version v1.5');
      expect(badge).toBeInTheDocument();
    });

    it('uses custom ARIA label when provided', () => {
      render(
        <VersionBadge
          version="v1.5"
          status="active"
          aria-label="Current version 1.5"
        />
      );
      const badge = screen.getByLabelText('Current version 1.5');
      expect(badge).toBeInTheDocument();
    });

    it('has role="button" when interactive', () => {
      render(<VersionBadge version="v1.5" onClick={vi.fn()} />);
      const badge = screen.getByRole('button');
      expect(badge).toBeInTheDocument();
    });

    it('does not have role="button" when not interactive', () => {
      render(<VersionBadge version="v1.5" />);
      const badge = screen.getByText('v1.5');
      expect(badge).not.toHaveAttribute('role', 'button');
    });

    it('is keyboard focusable when interactive', () => {
      render(<VersionBadge version="v1.5" onClick={vi.fn()} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveAttribute('tabIndex', '0');
    });

    it('is not keyboard focusable when not interactive', () => {
      render(<VersionBadge version="v1.5" />);
      const badge = screen.getByText('v1.5');
      expect(badge).not.toHaveAttribute('tabIndex');
    });

    it('has visible focus ring when interactive', () => {
      render(<VersionBadge version="v1.5" onClick={vi.fn()} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
    });
  });

  describe('Custom Styling Tests', () => {
    it('applies custom className alongside default classes', () => {
      render(<VersionBadge version="v1.5" className="custom-class" />);
      const badge = screen.getByText('v1.5');
      expect(badge).toHaveClass('custom-class');
      expect(badge).toHaveClass('inline-flex', 'rounded-full');
    });

    it('preserves all base classes', () => {
      render(<VersionBadge version="v1.5" />);
      const badge = screen.getByText('v1.5');
      expect(badge).toHaveClass('inline-flex', 'items-center', 'rounded-full', 'font-medium');
    });
  });

  describe('Edge Cases', () => {
    it('handles version without "v" prefix', () => {
      render(<VersionBadge version="1.5" />);
      expect(screen.getByText('1.5')).toBeInTheDocument();
    });

    it('handles major version format (vX.0)', () => {
      render(<VersionBadge version="v2.0" status="major" />);
      expect(screen.getByText('v2.0')).toBeInTheDocument();
    });

    it('handles high version numbers', () => {
      render(<VersionBadge version="v99.99" />);
      expect(screen.getByText('v99.99')).toBeInTheDocument();
    });

    it('renders multiple badges independently', () => {
      const { container } = render(
        <div>
          <VersionBadge version="v1.0" status="inactive" />
          <VersionBadge version="v1.5" status="active" />
          <VersionBadge version="v2.0" status="major" />
        </div>
      );
      expect(screen.getByText('v1.0')).toBeInTheDocument();
      expect(screen.getByText('v1.5')).toBeInTheDocument();
      expect(screen.getByText('v2.0')).toBeInTheDocument();
    });
  });
});
