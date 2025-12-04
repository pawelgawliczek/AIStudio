/**
 * StandardStateList Component
 * ST-168: Vertical list view for Story Details
 */

import React from 'react';
import { StandardStateListProps } from './types';
import { StateBlock } from './StateBlock';

export const StandardStateList: React.FC<StandardStateListProps> = ({
  states,
  componentRuns,
  expandedStates,
  onToggle,
  onStateClick,
}) => {
  const sortedStates = [...states].sort((a, b) => a.order - b.order);

  const handleStateClick = (stateId: string) => {
    onToggle(stateId);
    onStateClick?.(stateId);
  };

  return (
    <div data-testid="standard-state-list" className="space-y-2">
      {sortedStates.map((state) => {
        const componentRun = componentRuns?.find(
          (run) => run.id === state.id || run.componentId === state.componentId
        );

        return (
          <StateBlock
            key={state.id}
            state={state}
            componentRun={componentRun}
            isExpanded={expandedStates.has(state.id)}
            onToggle={() => handleStateClick(state.id)}
            variant="standard"
          />
        );
      })}
    </div>
  );
};
