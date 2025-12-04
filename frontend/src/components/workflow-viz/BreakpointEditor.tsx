/**
 * BreakpointEditor Component
 * ST-168: Add/edit breakpoint modal with condition builder
 */

import React, { useState, useEffect } from 'react';
import { WorkflowState, Breakpoint } from './types';

export interface BreakpointEditorProps {
  mode: 'add' | 'edit';
  stateId?: string;
  breakpoint?: Breakpoint;
  states: WorkflowState[];
  onSave: (breakpoint: BreakpointInput) => void;
  onClose: () => void;
}

export interface BreakpointInput {
  stateId: string;
  position: 'before' | 'after';
  condition?: BreakpointCondition | null;
  temporary?: boolean;
}

export interface BreakpointCondition {
  field: string;
  operator: '$gt' | '$gte' | '$lt' | '$lte' | '$eq' | '$ne';
  value: number;
}

const CONDITION_FIELDS = [
  { value: 'tokensUsed', label: 'Tokens Used', description: 'Total tokens consumed' },
  { value: 'agentSpawns', label: 'Agent Spawns', description: 'Number of agents spawned' },
  { value: 'stateTransitions', label: 'State Transitions', description: 'States completed' },
  { value: 'durationMs', label: 'Duration (ms)', description: 'Elapsed time in milliseconds' },
];

const OPERATORS = [
  { value: '$gt', label: '>', description: 'Greater than' },
  { value: '$gte', label: '>=', description: 'Greater than or equal' },
  { value: '$lt', label: '<', description: 'Less than' },
  { value: '$lte', label: '<=', description: 'Less than or equal' },
  { value: '$eq', label: '==', description: 'Equals' },
  { value: '$ne', label: '!=', description: 'Not equals' },
];

export const BreakpointEditor: React.FC<BreakpointEditorProps> = ({
  mode,
  stateId: initialStateId,
  breakpoint,
  states,
  onSave,
  onClose,
}) => {
  const [selectedStateId, setSelectedStateId] = useState<string>(
    breakpoint?.stateId || initialStateId || ''
  );
  const [position, setPosition] = useState<'before' | 'after'>(
    breakpoint?.position || 'before'
  );
  const [hasCondition, setHasCondition] = useState<boolean>(!!breakpoint?.condition);
  const [conditionField, setConditionField] = useState<string>('tokensUsed');
  const [conditionOperator, setConditionOperator] = useState<string>('$gt');
  const [conditionValue, setConditionValue] = useState<string>('10000');
  const [isTemporary, setIsTemporary] = useState<boolean>(false);

  // Parse existing condition on edit mode
  useEffect(() => {
    if (breakpoint?.condition) {
      const condition = breakpoint.condition;
      if (condition.$and) {
        // Complex condition - just use first one for simplicity
        const firstCond = condition.$and[0];
        const field = Object.keys(firstCond)[0];
        const op = Object.keys(firstCond[field])[0];
        const val = firstCond[field][op];
        setConditionField(field);
        setConditionOperator(op);
        setConditionValue(String(val));
      } else {
        // Simple condition
        const field = Object.keys(condition)[0];
        if (field) {
          const op = Object.keys(condition[field])[0];
          const val = condition[field][op];
          setConditionField(field);
          setConditionOperator(op);
          setConditionValue(String(val));
        }
      }
      setHasCondition(true);
    }
  }, [breakpoint]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const input: BreakpointInput = {
      stateId: selectedStateId,
      position,
      condition: hasCondition
        ? {
            field: conditionField,
            operator: conditionOperator as BreakpointCondition['operator'],
            value: parseInt(conditionValue, 10),
          }
        : null,
      temporary: isTemporary,
    };

    onSave(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakpoint-editor-title"
      data-testid="breakpoint-editor-modal"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 id="breakpoint-editor-title" className="text-lg font-semibold">
            {mode === 'add' ? 'Add Breakpoint' : 'Edit Breakpoint'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Target State */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target State
            </label>
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-200"
              required
              disabled={mode === 'edit'}
              data-testid="state-select"
            >
              <option value="">Select state...</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>

          {/* Position */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Position
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="position"
                  value="before"
                  checked={position === 'before'}
                  onChange={() => setPosition('before')}
                  className="text-blue-500"
                  data-testid="position-before"
                />
                <span className="text-gray-200">
                  Before state execution (pause before agent runs)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="position"
                  value="after"
                  checked={position === 'after'}
                  onChange={() => setPosition('after')}
                  className="text-blue-500"
                  data-testid="position-after"
                />
                <span className="text-gray-200">
                  After state completion (pause after post-instructions)
                </span>
              </label>
            </div>
          </div>

          {/* Conditional Breakpoint */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasCondition}
                onChange={(e) => setHasCondition(e.target.checked)}
                className="text-blue-500"
                data-testid="condition-toggle"
              />
              <span className="text-gray-200">Add conditional breakpoint</span>
            </label>

            {hasCondition && (
              <div
                className="mt-4 p-4 bg-gray-800 rounded border border-gray-700"
                data-testid="condition-builder"
              >
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={conditionField}
                    onChange={(e) => setConditionField(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
                    data-testid="condition-field"
                  >
                    {CONDITION_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={conditionOperator}
                    onChange={(e) => setConditionOperator(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
                    data-testid="condition-operator"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 w-24"
                    data-testid="condition-value"
                    min="0"
                    required={hasCondition}
                  />
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Available fields: tokensUsed, agentSpawns, stateTransitions, durationMs
                </div>
              </div>
            )}
          </div>

          {/* Temporary option */}
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isTemporary}
                onChange={(e) => setIsTemporary(e.target.checked)}
                className="text-blue-500"
                data-testid="temporary-toggle"
              />
              <span className="text-gray-200">
                Temporary (auto-clear after hit - for step-through debugging)
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              disabled={!selectedStateId}
              data-testid="save-breakpoint"
            >
              {mode === 'add' ? 'Add Breakpoint' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
