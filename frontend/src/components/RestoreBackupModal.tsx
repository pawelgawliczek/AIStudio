import { useState } from 'react';
import { BackupInfo } from '../services/backups.service';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface RestoreBackupModalProps {
  backup: BackupInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (backupFile: string) => void;
  isLoading?: boolean;
}

export function RestoreBackupModal({
  backup,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: RestoreBackupModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  const handleConfirm = () => {
    if (backup && confirmed) {
      onConfirm(backup.filename);
    }
  };

  if (!isOpen || !backup) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={handleClose}
        ></div>

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-card text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-border">
          {/* Header */}
          <div className="bg-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <ExclamationTriangleIcon
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-lg font-semibold leading-6 text-fg flex items-center justify-between">
                  Restore Backup
                  <button
                    onClick={handleClose}
                    className="text-muted hover:text-fg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    WARNING: This operation will DESTROY all current database data!
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    You are about to restore the following backup:
                  </p>
                  <div className="mt-3 bg-bg-secondary rounded-lg p-3 border border-border">
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">File:</dt>
                        <dd className="font-medium text-fg truncate ml-2" title={backup.filename}>
                          {backup.filename}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Size:</dt>
                        <dd className="font-medium text-fg">
                          {backup.sizeMB.toFixed(2)} MB
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Age:</dt>
                        <dd className="font-medium text-fg">{backup.age}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Environment:</dt>
                        <dd className="font-medium text-fg capitalize">
                          {backup.environment}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-border text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-fg">
                        I understand this will destroy all current data and restore from this backup
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-bg-secondary px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!confirmed || isLoading}
              className="inline-flex w-full justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            >
              {isLoading ? 'Restoring...' : 'Restore Backup'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-card px-4 py-2 text-sm font-semibold text-fg shadow-sm ring-1 ring-inset ring-border hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
