/**
 * BreakpointIndicator Component
 * ST-168: Display breakpoint information with actions
 */

import React from 'react';
import { BreakpointIndicatorProps } from './types';

export const BreakpointIndicator: React.FC<BreakpointIndicatorProps> = ({
  breakpoint,
  onClear,
  onEdit,
}) => {
  const formatCondition = (condition: any): string => {
    if (!condition) return '';

    const formatOperator = (op: string): string => {
      // Replace longer patterns first to avoid partial matches
      return op
        .replace('$gte', '>=')
        .replace('$lte', '<=')
        .replace('$ne', '!=')
        .replace('$eq', '==')
        .replace('$gt', '>')
        .replace('$lt', '<');
    };

    // Handle $and operator
    if (condition.$and && Array.isArray(condition.$and)) {
      return condition.$and
        .map((cond: any) => {
          const key = Object.keys(cond)[0];
          const operator = Object.keys(cond[key])[0];
          const value = cond[key][operator];
          return `${key} ${formatOperator(operator)} ${value}`;
        })
        .join(' AND ');
    }

    // Handle simple condition
    const key = Object.keys(condition)[0];
    if (key) {
      const operator = Object.keys(condition[key])[0];
      const value = condition[key][operator];
      return `${key} ${formatOperator(operator)} ${value}`;
    }

    return '';
  };

  const isHit = !!breakpoint.hitAt;
  const conditionText = breakpoint.condition ? formatCondition(breakpoint.condition) : null;

  const containerClasses = `
    border-2 rounded-lg p-3 my-2
    ${isHit ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-600 bg-gray-800/50'}
    ${!breakpoint.active ? 'opacity-50' : ''}
  `.trim();

  return (
    <div
      data-testid="breakpoint-indicator"
      className={containerClasses}
      aria-label={`Breakpoint at state ${breakpoint.position}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛑</span>
          <div>
            <div className="font-semibold text-sm">BREAKPOINT</div>
            <div className="text-xs text-gray-400">
              Position:{' '}
              <span className="text-gray-200">
                {breakpoint.position}
                {breakpoint.position === 'after' && (
                  <span data-testid="breakpoint-after-icon" className="ml-1">▼</span>
                )}
              </span>
            </div>
            {conditionText && (
              <div className="text-xs text-gray-400 mt-1">
                Condition: <span className="text-gray-200 font-mono">{conditionText}</span>
              </div>
            )}
            {!breakpoint.active && (
              <div className="text-xs text-red-400 mt-1">Cleared</div>
            )}
            {isHit && (
              <div className="text-xs text-yellow-400 mt-1">
                Hit at {new Date(breakpoint.hitAt!).toISOString().substring(11, 19)}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onClear?.(breakpoint.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClear?.(breakpoint.id);
              }
            }}
            className="px-3 py-1 text-xs rounded bg-red-500/20 hover:bg-red-500/30 text-red-400"
            aria-label="Clear breakpoint"
          >
            Clear
          </button>
          <button
            onClick={() => onEdit?.(breakpoint)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEdit?.(breakpoint);
              }
            }}
            className="px-3 py-1 text-xs rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
            aria-label="Edit breakpoint"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};
