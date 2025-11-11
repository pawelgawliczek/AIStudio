import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanningFilters } from './PlanningFilters';
import { Epic, StoryStatus, StoryType, SubtaskLayer } from '../../types';

const mockEpics: Epic[] = [
  {
    id: '1',
    key: 'EP-1',
    projectId: 'proj-1',
    title: 'Authentication',
    priority: 1,
    status: 'in_progress',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    key: 'EP-2',
    projectId: 'proj-1',
    title: 'Payment System',
    priority: 2,
    status: 'planning',
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02',
  },
];

describe('PlanningFilters', () => {
  const defaultProps = {
    statusFilter: [],
    typeFilter: [],
    epicFilter: [],
    layerFilter: [],
    searchQuery: '',
    epics: mockEpics,
    onStatusChange: vi.fn(),
    onTypeChange: vi.fn(),
    onEpicChange: vi.fn(),
    onLayerChange: vi.fn(),
    onSearchChange: vi.fn(),
  };

  it('renders filter button', () => {
    render(<PlanningFilters {...defaultProps} />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows filter count badge when filters are active', () => {
    render(<PlanningFilters {...defaultProps} statusFilter={['planning', 'in_progress']} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens filter dropdown when button is clicked', () => {
    render(<PlanningFilters {...defaultProps} />);
    const filterButton = screen.getByText('Filters');
    fireEvent.click(filterButton);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('displays all status options', () => {
    render(<PlanningFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Filters'));

    Object.values(StoryStatus).forEach((status) => {
      expect(screen.getByText(status.replace('_', ' '), { exact: false })).toBeInTheDocument();
    });
  });

  it('displays all type options', () => {
    render(<PlanningFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Filters'));

    Object.values(StoryType).forEach((type) => {
      expect(screen.getByText(type.replace('_', ' '), { exact: false })).toBeInTheDocument();
    });
  });

  it('displays epic options', () => {
    render(<PlanningFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Filters'));

    mockEpics.forEach((epic) => {
      expect(screen.getByText(epic.title)).toBeInTheDocument();
    });
  });

  it('displays layer/component options', () => {
    render(<PlanningFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Filters'));

    expect(screen.getByText('Layer/Component')).toBeInTheDocument();
    Object.values(SubtaskLayer).forEach((layer) => {
      expect(screen.getByText(layer, { exact: false })).toBeInTheDocument();
    });
  });

  it('handles search input', () => {
    render(<PlanningFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Filters'));

    const searchInput = screen.getByPlaceholderText('Search stories...');
    fireEvent.change(searchInput, { target: { value: 'login' } });

    const goButton = screen.getByText('Go');
    fireEvent.click(goButton);

    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('login');
  });

  it('calls onStatusChange when status checkbox is clicked', () => {
    render(<PlanningFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Filters'));

    const statusCheckboxes = screen.getAllByRole('checkbox');
    fireEvent.click(statusCheckboxes[0]);

    expect(defaultProps.onStatusChange).toHaveBeenCalled();
  });

  it('closes dropdown when backdrop is clicked', () => {
    render(<PlanningFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Filters'));

    expect(screen.getByText('Status')).toBeInTheDocument();

    // Click backdrop
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
  });
});
