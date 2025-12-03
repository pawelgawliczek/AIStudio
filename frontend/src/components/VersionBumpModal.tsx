import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { versioningService } from '../services/versioning.service';
import { VersionBadge } from './VersionBadge';

export interface VersionBumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'component' | 'workflow';
  entityId: string;
  entityName: string;
  currentVersion: string;
  onSuccess?: (newVersion: string) => void;
  onError?: (error: Error) => void;
}

interface VersionBumpFormData {
  versionType: 'minor' | 'major';
  changeDescription: string;
}

/**
 * Calculate next version based on current version and bump type
 * @param current - Current version (e.g., "v1.5")
 * @param type - Version bump type (minor or major)
 * @returns Next version string (e.g., "v1.6" or "v2.0")
 */
export const calculateNextVersion = (
  current: string,
  type: 'minor' | 'major'
): string => {
  const match = current.match(/^v?(\d+)\.(\d+)$/);
  if (!match) {
    return 'v1.0';
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);

  if (type === 'major') {
    return `v${major + 1}.0`;
  }
  return `v${major}.${minor + 1}`;
};

/**
 * Validate form data
 * @param data - Form data to validate
 * @returns Validation result with errors array
 */
export const validateForm = (data: VersionBumpFormData): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (data.changeDescription && data.changeDescription.length > 500) {
    errors.push('Change description must not exceed 500 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * VersionBumpModal - Reusable modal for creating new versions
 *
 * @example
 * ```tsx
 * <VersionBumpModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   entityType="component"
 *   entityId="uuid"
 *   entityName="BA Component"
 *   currentVersion="v1.5"
 *   onSuccess={(newVersion) => console.log('Created:', newVersion)}
 * />
 * ```
 */
export function VersionBumpModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  currentVersion,
  onSuccess,
  onError,
}: VersionBumpModalProps) {
  const [formData, setFormData] = useState<VersionBumpFormData>({
    versionType: 'minor',
    changeDescription: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        versionType: 'minor',
        changeDescription: '',
      });
      setError(null);
    }
  }, [isOpen]);

  const nextVersion = calculateNextVersion(currentVersion, formData.versionType);

  const handleVersionTypeChange = (type: 'minor' | 'major') => {
    setFormData((prev) => ({ ...prev, versionType: type }));
  };

  const handleChangeDescriptionChange = (value: string) => {
    setFormData((prev) => ({ ...prev, changeDescription: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const validation = validateForm(formData);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestData = {
        majorVersion: formData.versionType === 'major' ? undefined : undefined,
        changeDescription: formData.changeDescription || undefined,
      };

      // For major version, we need to calculate the major version number
      if (formData.versionType === 'major') {
        const match = currentVersion.match(/^v?(\d+)\.(\d+)$/);
        if (match) {
          const major = parseInt(match[1], 10);
          requestData.majorVersion = major + 1;
        }
      }

      let newVersion;
      if (entityType === 'component') {
        newVersion = await versioningService.createComponentVersion(entityId, requestData);
      } else {
        newVersion = await versioningService.createWorkflowVersion(entityId, requestData);
      }

      const versionString = `v${newVersion.versionMajor}.${newVersion.versionMinor}`;

      if (onSuccess) {
        onSuccess(versionString);
      }

      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create version';
      setError(errorMessage);

      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const characterCount = formData.changeDescription.length;
  const isOverLimit = characterCount > 500;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative" style={{ zIndex: 1400 }} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100"
                    >
                      Create New Version
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {entityName}
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                      {/* Current Version Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Current Version
                        </label>
                        <VersionBadge version={currentVersion} status="current" size="md" />
                      </div>

                      {/* Version Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Version Type
                        </label>
                        <div className="space-y-2" role="radiogroup" aria-label="Version type selection">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="versionType"
                              value="minor"
                              checked={formData.versionType === 'minor'}
                              onChange={() => handleVersionTypeChange('minor')}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                              Minor Version (Backward Compatible)
                            </span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="versionType"
                              value="major"
                              checked={formData.versionType === 'major'}
                              onChange={() => handleVersionTypeChange('major')}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                              Major Version (Breaking Changes)
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Version Preview */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Preview
                        </label>
                        <div
                          className="flex items-center gap-2"
                          role="status"
                          aria-live="polite"
                          aria-label={`Version will be updated from ${currentVersion} to ${nextVersion}`}
                        >
                          <VersionBadge version={currentVersion} status="previous" size="md" />
                          <span className="text-gray-400" aria-hidden="true">→</span>
                          <VersionBadge
                            version={nextVersion}
                            status={formData.versionType === 'major' ? 'major' : 'current'}
                            size="md"
                          />
                        </div>
                      </div>

                      {/* Change Description */}
                      <div>
                        <label
                          htmlFor="changeDescription"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Change Description (Optional)
                        </label>
                        <textarea
                          id="changeDescription"
                          rows={3}
                          value={formData.changeDescription}
                          onChange={(e) => handleChangeDescriptionChange(e.target.value)}
                          className={`block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 dark:bg-gray-700 shadow-sm ring-1 ring-inset ${
                            isOverLimit
                              ? 'ring-red-500 focus:ring-red-500'
                              : 'ring-gray-300 dark:ring-gray-600 focus:ring-blue-500'
                          } placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                          placeholder="Describe the changes in this version..."
                          aria-describedby="changeDescription-counter"
                        />
                        <p
                          id="changeDescription-counter"
                          className={`mt-1 text-sm ${
                            isOverLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {characterCount} / 500 characters
                        </p>
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div
                          className="rounded-md bg-red-50 dark:bg-red-900/20 p-4"
                          role="alert"
                          aria-live="assertive"
                        >
                          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                        <button
                          type="submit"
                          disabled={isLoading || isOverLimit}
                          className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? 'Creating...' : 'Create Version'}
                        </button>
                        <button
                          type="button"
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto"
                          onClick={onClose}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
