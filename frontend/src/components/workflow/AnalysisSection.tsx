import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface AnalysisSectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  content?: string | null;
  timestamp?: string | null;
  defaultOpen?: boolean;
  emptyMessage?: string;
}

export function AnalysisSection({
  title,
  icon: Icon,
  content,
  timestamp,
  defaultOpen = false,
  emptyMessage = 'No analysis available yet'
}: AnalysisSectionProps) {
  const hasContent = content && content.trim().length > 0;

  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className="border border-border rounded-lg overflow-hidden">
          <Disclosure.Button
            className="flex w-full items-center justify-between bg-card px-4 py-3 text-left hover:bg-card/80 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            aria-label={`${title}. Click to ${open ? 'collapse' : 'expand'}`}
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5 text-muted" />}
              <span className="font-medium text-fg">{title}</span>
              {timestamp && hasContent && (
                <span className="text-xs text-muted bg-muted/10 px-2 py-0.5 rounded">
                  {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                </span>
              )}
            </div>
            <ChevronDownIcon
              className={`h-5 w-5 text-muted transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </Disclosure.Button>

          <Transition
            enter="transition duration-200 ease-out"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition duration-150 ease-in"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-1"
          >
            <Disclosure.Panel className="px-4 pt-4 pb-2 bg-card">
              {hasContent ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-fg prose-p:text-fg prose-a:text-accent prose-strong:text-fg prose-code:text-accent-fg prose-code:bg-accent/10 prose-pre:bg-card prose-pre:border prose-pre:border-border max-h-96 overflow-y-auto">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm text-muted italic py-4">
                  <p>{emptyMessage}</p>
                  <p className="text-xs mt-2">
                    This section will be populated when the {title} component runs.
                  </p>
                </div>
              )}
            </Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
}
