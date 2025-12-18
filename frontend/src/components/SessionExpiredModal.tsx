import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const { redirectPath } = useAuth();

  // Show modal when session expires (redirectPath is set)
  useEffect(() => {
    if (redirectPath) {
      setIsOpen(true);
      setCountdown(10);
    }
  }, [redirectPath]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, countdown]);

  // Auto-redirect when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      setIsOpen(false);
      // Redirect is handled by AuthContext
    }
  }, [countdown]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-fg">
                      Session Expired
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-muted">
                        Your session has expired due to inactivity. Please log in again to continue.
                      </p>
                      {redirectPath && (
                        <p className="mt-2 text-sm text-muted">
                          You'll be redirected back to <span className="font-medium text-accent">{redirectPath}</span> after logging in.
                        </p>
                      )}
                      <p className="mt-4 text-sm font-medium text-fg">
                        Redirecting to login in {countdown} second{countdown !== 1 ? 's' : ''}...
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors"
                    onClick={handleClose}
                  >
                    Go to Login Now
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
