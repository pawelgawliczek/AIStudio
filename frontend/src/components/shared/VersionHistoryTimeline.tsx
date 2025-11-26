import { ClockIcon } from '@heroicons/react/24/outline';
import { ComponentVersion, CoordinatorVersion } from '../../services/versioning.service';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export interface VersionHistoryTimelineProps {
  versions: (ComponentVersion | CoordinatorVersion)[];
  entityType: 'component' | 'coordinator';
  selectedVersions: [string | null, string | null];
  onVersionSelect: (versionId: string, checked: boolean) => void;
  onCompare: () => void;
  isLoading: boolean;
}

export function VersionHistoryTimeline({
  versions,
  entityType,
  selectedVersions,
  onVersionSelect,
  onCompare,
  isLoading,
}: VersionHistoryTimelineProps) {
  const [selectedVersion1, selectedVersion2] = selectedVersions;

  const handleCheckboxChange = (versionId: string, checked: boolean) => {
    onVersionSelect(versionId, checked);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-12">
        <ClockIcon className="w-12 h-12 text-fg mx-auto mb-3" />
        <p className="text-fg mb-2">No version history</p>
        <p className="text-sm text-fg">
          This {entityType} has no version history yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
        <div className="space-y-4">
          {versions.map((version, index) => {
            const isLatest = index === 0;
            const isSelected = selectedVersion1 === version.id || selectedVersion2 === version.id;
            const decisionStrategy = 'decisionStrategy' in version ? version.decisionStrategy : undefined;

            return (
              <div key={version.id} className="relative flex items-start gap-4">
                {/* Timeline node */}
                <div className="relative z-10">
                  <div
                    className={classNames(
                      'w-16 h-16 rounded-full flex items-center justify-center border-4',
                      isLatest
                        ? 'bg-green-100 dark:bg-green-900/20 border-green-500'
                        : 'bg-bg-secondary border-border'
                    )}
                  >
                    <span className="text-sm font-bold text-fg">{version.version}</span>
                  </div>
                </div>

                {/* Version card */}
                <div className={classNames(
                  'flex-1 bg-card border rounded-lg p-4',
                  isSelected ? 'border-accent ring-2 ring-accent/20' : 'border-border'
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-fg">Version {version.version}</span>
                        {isLatest && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-fg">
                        {new Date(version.createdAt).toLocaleString()} · {version.createdBy || 'System'}
                      </div>
                    </div>

                    {/* Selection checkbox */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleCheckboxChange(version.id, e.target.checked)}
                          className="rounded border-gray-300 text-accent focus:ring-accent"
                        />
                        <span className="text-xs text-fg">Compare</span>
                      </label>
                    </div>
                  </div>

                  {version.changeDescription && (
                    <p className="text-sm text-fg mb-3 italic">{version.changeDescription}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-bg-secondary p-2 rounded">
                      <div className="text-fg">Model</div>
                      <div className="font-medium text-fg">{version.config.modelId}</div>
                    </div>
                    <div className="bg-bg-secondary p-2 rounded">
                      <div className="text-fg">Temp</div>
                      <div className="font-medium text-fg">{version.config.temperature}</div>
                    </div>
                    {decisionStrategy ? (
                      <div className="bg-bg-secondary p-2 rounded">
                        <div className="text-fg">Strategy</div>
                        <div className="font-medium text-fg capitalize">{decisionStrategy}</div>
                      </div>
                    ) : (
                      <div className="bg-bg-secondary p-2 rounded">
                        <div className="text-fg">Tools</div>
                        <div className="font-medium text-fg">{version.tools.length}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compare Button */}
      {selectedVersion1 && selectedVersion2 && (
        <div className="flex items-center justify-center pt-4 border-t border-border">
          <button
            onClick={onCompare}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
          >
            Compare Selected Versions
          </button>
        </div>
      )}
    </div>
  );
}
