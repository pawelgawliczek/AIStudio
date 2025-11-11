import { Subtask, SubtaskLayer } from '../../types';

interface SubtasksListProps {
  subtasks: Subtask[];
}

export function SubtasksList({ subtasks }: SubtasksListProps) {
  const getLayerIcon = (layer?: SubtaskLayer) => {
    switch (layer) {
      case 'frontend':
        return '🎨';
      case 'backend':
        return '⚙️';
      case 'tests':
        return '🧪';
      case 'docs':
        return '📚';
      case 'infra':
        return '🏗️';
      default:
        return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'text-green-600';
      case 'in_progress':
        return 'text-blue-600';
      case 'review':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-1">
      {subtasks.map((subtask, index) => {
        const isLast = index === subtasks.length - 1;
        return (
          <div key={subtask.id} className="flex items-start gap-2 text-sm">
            {/* Tree connector */}
            <span className="text-gray-400 mt-1">
              {isLast ? '└─' : '├─'}
            </span>

            {/* Layer icon */}
            <span className="text-base" title={subtask.layer || 'No layer'}>
              {getLayerIcon(subtask.layer)}
            </span>

            {/* Subtask info */}
            <div className="flex-1">
              <span className="text-gray-700">{subtask.title}</span>
            </div>

            {/* Status */}
            <span className={`text-xs font-medium capitalize ${getStatusColor(subtask.status)}`}>
              {subtask.status.replace('_', ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
