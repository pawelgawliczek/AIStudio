import { render, screen } from '@testing-library/react';
import { RunStatusBadge } from '../RunStatusBadge';
import { RunStatus } from '../../../services/workflow-runs.service';

describe('RunStatusBadge', () => {
  it('renders completed status correctly', () => {
    render(<RunStatusBadge status={RunStatus.COMPLETED} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders running status correctly', () => {
    render(<RunStatusBadge status={RunStatus.RUNNING} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('⏸')).toBeInTheDocument();
  });

  it('renders failed status correctly', () => {
    render(<RunStatusBadge status={RunStatus.FAILED} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('renders pending status correctly', () => {
    render(<RunStatusBadge status={RunStatus.PENDING} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('⚪')).toBeInTheDocument();
  });

  it('renders cancelled status correctly', () => {
    render(<RunStatusBadge status={RunStatus.CANCELLED} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('🚫')).toBeInTheDocument();
  });

  it('applies correct CSS classes for completed status', () => {
    const { container } = render(<RunStatusBadge status={RunStatus.COMPLETED} />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-green-100');
  });

  it('applies correct CSS classes for failed status', () => {
    const { container } = render(<RunStatusBadge status={RunStatus.FAILED} />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-red-100');
  });
});
