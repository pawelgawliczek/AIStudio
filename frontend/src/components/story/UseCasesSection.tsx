import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon, DocumentTextIcon, BeakerIcon } from '@heroicons/react/24/outline';

interface TestCase {
  id: string;
  key: string;
  title: string;
  testLevel: string;
  status: string;
  testFilePath?: string;
}

interface UseCase {
  id: string;
  key: string;
  title: string;
  area?: string;
  testCases?: TestCase[];
}

interface UseCaseLink {
  id: string;
  relation: 'implements' | 'modifies' | 'deprecates';
  useCase: UseCase;
}

interface UseCasesSectionProps {
  useCaseLinks?: UseCaseLink[];
}

const RELATION_COLORS: Record<string, string> = {
  implements: 'bg-green-500/10 text-green-600 border-green-500/20',
  modifies: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  deprecates: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const TEST_STATUS_COLORS: Record<string, string> = {
  implemented: 'bg-green-500/10 text-green-600',
  pending: 'bg-gray-500/10 text-gray-600',
  in_progress: 'bg-yellow-500/10 text-yellow-600',
};

export function UseCasesSection({ useCaseLinks = [] }: UseCasesSectionProps) {
  if (useCaseLinks.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <DocumentTextIcon className="h-5 w-5 text-muted" />
          <h3 className="font-medium text-fg">Use Cases</h3>
        </div>
        <p className="text-sm text-muted italic">No use cases linked yet</p>
      </div>
    );
  }

  // Calculate total test cases across all use cases
  const totalTestCases = useCaseLinks.reduce(
    (sum, link) => sum + (link.useCase.testCases?.length || 0),
    0
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-muted" />
          <h3 className="font-medium text-fg">Use Cases ({useCaseLinks.length})</h3>
          {totalTestCases > 0 && (
            <span className="text-xs text-muted ml-2">{totalTestCases} test cases</span>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {useCaseLinks.map((link) => (
          <Disclosure key={link.id}>
            {({ open }) => (
              <>
                <Disclosure.Button className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-card/80 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                        RELATION_COLORS[link.relation] || RELATION_COLORS.implements
                      }`}
                    >
                      {link.relation}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted">{link.useCase.key}</span>
                        <span className="text-sm font-medium text-fg">{link.useCase.title}</span>
                      </div>
                      {link.useCase.area && (
                        <span className="text-xs text-muted">{link.useCase.area}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.useCase.testCases && link.useCase.testCases.length > 0 && (
                      <span className="text-xs text-muted flex items-center gap-1">
                        <BeakerIcon className="h-3 w-3" />
                        {link.useCase.testCases.length} tests
                      </span>
                    )}
                    <ChevronDownIcon
                      className={`h-5 w-5 text-muted transition-transform duration-200 ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </Disclosure.Button>

                {link.useCase.testCases && link.useCase.testCases.length > 0 && (
                  <Transition
                    enter="transition duration-200 ease-out"
                    enterFrom="opacity-0 -translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition duration-150 ease-in"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 -translate-y-1"
                  >
                    <Disclosure.Panel className="px-4 pb-4 bg-card/50">
                      <div className="mt-2 space-y-2">
                        <h4 className="text-xs font-medium text-muted mb-2">
                          Test Cases ({link.useCase.testCases.length})
                        </h4>
                        {link.useCase.testCases.map((testCase) => (
                          <div
                            key={testCase.id}
                            className="border border-border rounded p-2 bg-card"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted">{testCase.key}</span>
                                <span className="text-sm text-fg">{testCase.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted uppercase">
                                  {testCase.testLevel}
                                </span>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    TEST_STATUS_COLORS[testCase.status] || TEST_STATUS_COLORS.pending
                                  }`}
                                >
                                  {testCase.status}
                                </span>
                              </div>
                            </div>
                            {testCase.testFilePath && (
                              <p className="text-xs text-muted mt-1 font-mono">
                                {testCase.testFilePath}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </Disclosure.Panel>
                  </Transition>
                )}
              </>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
