import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { MarkdownEditor } from './MarkdownEditor';

interface CreateEpicModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    priority?: number;
  }) => void;
  isLoading?: boolean;
  initialData?: {
    title: string;
    description?: string;
    priority?: number;
  };
}

export function CreateEpicModal({
  open,
  onClose,
  onSubmit,
  isLoading = false,
  initialData,
}: CreateEpicModalProps) {
  const isEditing = !!initialData;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number>(3);

  // Populate form with initial data when editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      // Clamp priority to valid range (0-10) to match backend validation
      // This prevents validation errors while preserving the value when possible
      setPriority(Math.min(Math.max(initialData.priority ?? 3, 0), 10));
    } else {
      // Reset form when creating new
      setTitle('');
      setDescription('');
      setPriority(3);
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      priority,
    });
    // Form will be reset via useEffect when modal closes
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-card text-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                    <Dialog.Title
                      as="h3"
                      className="text-xl font-semibold leading-6 text-fg mb-6"
                    >
                      {isEditing ? 'Edit Epic' : 'Create New Epic'}
                    </Dialog.Title>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Title */}
                      <div>
                        <label
                          htmlFor="title"
                          className="block text-sm font-medium text-fg mb-2"
                        >
                          Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="title"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm py-2.5 px-4 bg-bg text-fg"
                          placeholder="Enter epic title..."
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label
                          htmlFor="description"
                          className="block text-sm font-medium text-fg mb-2"
                        >
                          Description
                        </label>
                        <MarkdownEditor
                          value={description}
                          onChange={setDescription}
                          placeholder="Describe the epic and its objectives... (Markdown supported)"
                          height={250}
                        />
                      </div>

                      {/* Priority */}
                      <div>
                        <label
                          htmlFor="priority"
                          className="block text-sm font-medium text-fg mb-2"
                        >
                          Priority
                        </label>
                        <select
                          id="priority"
                          value={priority}
                          onChange={(e) => setPriority(Number(e.target.value))}
                          className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm py-2.5 px-4 bg-bg text-fg"
                        >
                          <option value="0">0 - Lowest</option>
                          <option value="1">1 - Very Low</option>
                          <option value="2">2 - Low</option>
                          <option value="3">3 - Below Normal</option>
                          <option value="4">4 - Normal</option>
                          <option value="5">5 - Above Normal</option>
                          <option value="6">6 - Elevated</option>
                          <option value="7">7 - High</option>
                          <option value="8">8 - Very High</option>
                          <option value="9">9 - Critical</option>
                          <option value="10">10 - Highest</option>
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          type="button"
                          className="inline-flex justify-center rounded-md border border-border bg-bg-secondary px-4 py-2 text-sm font-medium text-fg shadow-sm hover:bg-accent hover:text-accent-fg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
                          onClick={onClose}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="inline-flex justify-center rounded-md border border-transparent bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 transition-all"
                          disabled={isLoading}
                        >
                          {isLoading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Epic' : 'Create Epic')}
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
