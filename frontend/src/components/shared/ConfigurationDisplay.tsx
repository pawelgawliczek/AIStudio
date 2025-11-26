import { PencilIcon } from '@heroicons/react/24/outline';
import { ExecutionConfig } from '../../types';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export interface ConfigurationDisplayProps {
  config: ExecutionConfig;
  tools: string[];
  tags?: string[];
  onFailure?: 'stop' | 'skip' | 'retry' | 'pause';
  // Coordinator-specific
  decisionStrategy?: 'sequential' | 'parallel' | 'conditional' | 'adaptive';
  domain?: string;
  // Edit mode
  isEditing: boolean;
  onChange?: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

interface ConfigFieldProps {
  label: string;
  value: string | number | undefined;
  field?: string;
  isEditing: boolean;
  onChange?: (field: string, value: any) => void;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}

function ConfigField({
  label,
  value,
  field,
  isEditing,
  onChange,
  type = 'text',
  options,
  placeholder,
  error,
}: ConfigFieldProps) {
  const displayValue = value ?? (type === 'number' ? 'Default' : 'Not set');

  if (!isEditing) {
    return (
      <div>
        <div className="text-fg text-sm">{label}</div>
        <div className="font-medium text-fg">{displayValue}</div>
      </div>
    );
  }

  // Edit mode
  const inputClasses = classNames(
    'w-full px-2 py-1 text-sm border rounded bg-bg text-fg',
    'focus:outline-none focus:ring-2 focus:ring-accent',
    error ? 'border-red-500' : 'border-border'
  );

  if (type === 'select' && options) {
    return (
      <div>
        <label className="text-fg text-sm">{label}</label>
        <select
          value={value ?? ''}
          onChange={(e) => field && onChange?.(field, e.target.value)}
          className={inputClasses}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="text-fg text-sm">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => field && onChange?.(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className={inputClasses}
        step={type === 'number' ? 'any' : undefined}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function ConfigurationDisplay({
  config,
  tools,
  tags = [],
  onFailure,
  decisionStrategy,
  domain,
  isEditing,
  onChange,
  errors = {},
}: ConfigurationDisplayProps) {
  const isCoordinator = decisionStrategy !== undefined;

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className={classNames(
        'border-t pt-6',
        isEditing ? 'relative' : ''
      )}>
        {isEditing && (
          <div className="absolute -top-2 left-2 px-2 py-0.5 text-xs bg-accent text-white rounded z-10 flex items-center gap-1">
            <PencilIcon className="w-3 h-3" />
            <span>Editing</span>
          </div>
        )}

        <h3 className="text-lg font-semibold text-fg mb-4">Configuration</h3>

        <div className={classNames(
          'grid gap-4 text-sm',
          isCoordinator ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'
        )}>
          {/* Coordinator-specific fields */}
          {isCoordinator && domain !== undefined && (
            <ConfigField
              label="Domain"
              value={domain}
              field="domain"
              isEditing={isEditing}
              onChange={onChange}
              error={errors.domain}
            />
          )}

          {isCoordinator && decisionStrategy && (
            <ConfigField
              label="Decision Strategy"
              value={decisionStrategy}
              field="decisionStrategy"
              isEditing={isEditing}
              onChange={onChange}
              type="select"
              options={[
                { value: 'sequential', label: 'Sequential' },
                { value: 'parallel', label: 'Parallel' },
                { value: 'conditional', label: 'Conditional' },
                { value: 'adaptive', label: 'Adaptive' },
              ]}
              error={errors.decisionStrategy}
            />
          )}

          {/* Common config fields */}
          <ConfigField
            label="Model ID"
            value={config.modelId}
            field="config.modelId"
            isEditing={isEditing}
            onChange={onChange}
            error={errors['config.modelId']}
          />

          <ConfigField
            label="Temperature"
            value={config.temperature}
            field="config.temperature"
            isEditing={isEditing}
            onChange={onChange}
            type="number"
            error={errors['config.temperature']}
          />

          <ConfigField
            label="Max Tokens (In/Out)"
            value={`${config.maxInputTokens || 'Default'} / ${config.maxOutputTokens || 'Default'}`}
            isEditing={false}
            onChange={onChange}
          />

          <ConfigField
            label="Timeout"
            value={config.timeout ? `${config.timeout}s` : 'Default'}
            field="config.timeout"
            isEditing={isEditing}
            onChange={onChange}
            type="number"
            error={errors['config.timeout']}
          />

          {onFailure && (
            <ConfigField
              label="On Failure"
              value={onFailure}
              field="onFailure"
              isEditing={isEditing}
              onChange={onChange}
              type="select"
              options={[
                { value: 'stop', label: 'Stop' },
                { value: 'skip', label: 'Skip' },
                { value: 'retry', label: 'Retry' },
                { value: 'pause', label: 'Pause' },
              ]}
              error={errors.onFailure}
            />
          )}

          <ConfigField
            label="Cost Limit"
            value={config.costLimit ? `$${config.costLimit}` : 'No limit'}
            field="config.costLimit"
            isEditing={isEditing}
            onChange={onChange}
            type="number"
            error={errors['config.costLimit']}
          />
        </div>
      </div>

      {/* Tools Section */}
      {tools.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-fg mb-2">MCP Tools</h3>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <span
                key={tool}
                className="px-3 py-1 text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags Section */}
      {tags.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-fg mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
