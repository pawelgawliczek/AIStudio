/**
 * Tests for StoryCreationDialog component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StoryCreationDialog } from '../StoryCreationDialog';

describe('StoryCreationDialog', () => {
  it('should not render when closed', () => {
    const { container } = render(
      <StoryCreationDialog
        isOpen={false}
        title=""
        description=""
        context={null}
        isCreating={false}
        onTitleChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render when open', () => {
    render(
      <StoryCreationDialog
        isOpen={true}
        title="Test Story"
        description="Test Description"
        context={null}
        isCreating={false}
        onTitleChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Test Story')).toBeInTheDocument();
  });

  it('should call onSave when create button clicked', () => {
    const onSave = vi.fn();
    render(
      <StoryCreationDialog
        isOpen={true}
        title="Test"
        description=""
        context={null}
        isCreating={false}
        onTitleChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Create Story'));
    expect(onSave).toHaveBeenCalled();
  });
});
