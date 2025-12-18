import { Tab } from '@headlessui/react';
import {
  DocumentTextIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import React, { Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';

interface StoryDetailTabsProps {
  storyContent: React.ReactNode;
  executionContent: React.ReactNode;
}

const tabs = [
  { id: 'story', label: 'Story', icon: DocumentTextIcon },
  { id: 'execution', label: 'Execution', icon: PlayIcon },
];

export function StoryDetailTabs({ storyContent, executionContent }: StoryDetailTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'story';
  const defaultIndex = tabs.findIndex(t => t.id === currentTab);

  const handleTabChange = (index: number) => {
    const newTab = tabs[index].id;
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('tab', newTab);
      return params;
    });
  };

  return (
    <Tab.Group defaultIndex={defaultIndex >= 0 ? defaultIndex : 0} onChange={handleTabChange}>
      <Tab.List className="flex border-b border-border bg-card mb-6 rounded-t-lg overflow-hidden">
        {tabs.map((tab) => (
          <Tab key={tab.id} as={Fragment}>
            {({ selected }) => (
              <button
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors focus:outline-none ${
                  selected
                    ? 'border-b-2 border-accent text-accent bg-card'
                    : 'text-muted hover:text-fg hover:bg-bg-secondary'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            )}
          </Tab>
        ))}
      </Tab.List>

      <Tab.Panels>
        <Tab.Panel>{storyContent}</Tab.Panel>
        <Tab.Panel>{executionContent}</Tab.Panel>
      </Tab.Panels>
    </Tab.Group>
  );
}
