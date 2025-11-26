import { PencilIcon } from '@heroicons/react/24/outline';
import { terminology } from '../../utils/terminology';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export interface InstructionSetsDisplayProps {
  // Component instruction sets
  inputInstructions?: string;
  operationInstructions?: string;
  outputInstructions?: string;
  // Coordinator instruction (single instruction)
  coordinatorInstructions?: string;
  // Edit mode
  isEditing: boolean;
  onChange?: (field: string, value: string) => void;
  errors?: Record<string, string>;
}

interface InstructionFieldProps {
  label: string;
  field: string;
  value: string;
  isEditing: boolean;
  onChange?: (field: string, value: string) => void;
  error?: string;
  required?: boolean;
}

function InstructionField({
  label,
  field,
  value,
  isEditing,
  onChange,
  error,
  required = false,
}: InstructionFieldProps) {
  if (!isEditing) {
    // View mode - read-only display
    return (
      <div>
        <h3 className="text-sm font-semibold text-fg mb-2">{label}</h3>
        <div className="text-sm text-fg whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border min-h-[100px]">
          {value || <span className="text-fg/50 italic">No instructions provided</span>}
        </div>
      </div>
    );
  }

  // Edit mode - editable textarea
  return (
    <div className="relative">
      {/* Editing indicator */}
      <div className="absolute -top-2 -left-2 px-2 py-0.5 text-xs bg-accent text-white rounded z-10 flex items-center gap-1">
        <PencilIcon className="w-3 h-3" />
        <span>Editing</span>
      </div>

      <div className="pt-2">
        <label className="text-sm font-semibold text-fg mb-2 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange?.(field, e.target.value)}
          className={classNames(
            'w-full min-h-[150px] p-3 rounded border text-sm text-fg bg-bg',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
            'ring-2 ring-accent/30 transition-all',
            error ? 'border-red-500' : 'border-border'
          )}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}

export function InstructionSetsDisplay({
  inputInstructions,
  operationInstructions,
  outputInstructions,
  coordinatorInstructions,
  isEditing,
  onChange,
  errors = {},
}: InstructionSetsDisplayProps) {
  // Check if this is a coordinator (has coordinatorInstructions) or component (has 3 instruction sets)
  const isCoordinator = coordinatorInstructions !== undefined;

  if (isCoordinator) {
    // Project Manager: Single instruction field
    return (
      <div className="space-y-4">
        <InstructionField
          label={`${terminology.projectManager} Instructions`}
          field="coordinatorInstructions"
          value={coordinatorInstructions || ''}
          isEditing={isEditing}
          onChange={onChange}
          error={errors.coordinatorInstructions}
          required
        />
      </div>
    );
  }

  // Agent: Three instruction sets
  return (
    <div className="space-y-4">
      <InstructionField
        label="Input Instructions"
        field="inputInstructions"
        value={inputInstructions || ''}
        isEditing={isEditing}
        onChange={onChange}
        error={errors.inputInstructions}
        required
      />

      <InstructionField
        label="Operation Instructions"
        field="operationInstructions"
        value={operationInstructions || ''}
        isEditing={isEditing}
        onChange={onChange}
        error={errors.operationInstructions}
        required
      />

      <InstructionField
        label="Output Instructions"
        field="outputInstructions"
        value={outputInstructions || ''}
        isEditing={isEditing}
        onChange={onChange}
        error={errors.outputInstructions}
        required
      />
    </div>
  );
}
