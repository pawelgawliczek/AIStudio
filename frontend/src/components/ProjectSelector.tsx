import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import React, { Fragment, useState } from 'react';
import { useProject } from '../context/ProjectContext';

export function ProjectSelector() {
  const { projects, selectedProject, setSelectedProject, isLoading } = useProject();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="w-72" data-testid="project-selector">
        <div className="animate-pulse bg-bg-secondary h-10 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="w-72" data-testid="project-selector">
      <Listbox value={selectedProject} onChange={setSelectedProject}>
        {({ open }) => (
          <>
            <div className="relative">
              <Listbox.Button
                className="relative w-full cursor-pointer rounded-lg bg-card py-2 pl-3 pr-10 text-left shadow-sm border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-shadow sm:text-sm"
                data-testid="project-dropdown"
              >
                <span className="block truncate text-fg">
                  {selectedProject ? selectedProject.name : 'Select a project'}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                </span>
              </Listbox.Button>

              <Transition
                show={open}
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-card py-1 text-base shadow-lg border border-border focus:outline-none sm:text-sm">
                  {/* Search input */}
                  <div className="sticky top-0 bg-card px-3 py-2 border-b border-border">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        className="w-full rounded-md border border-border py-1.5 pl-10 pr-3 bg-bg-secondary text-fg placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-ring transition-colors sm:text-sm"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid="project-search"
                      />
                    </div>
                  </div>

                  {filteredProjects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted">No projects found</div>
                  ) : (
                    filteredProjects.map((project) => (
                      <Listbox.Option
                        key={project.id}
                        value={project}
                        data-testid={`project-option-${project.id}`}
                        className={({ active }) =>
                          clsx(
                            'relative cursor-pointer select-none py-2 pl-3 pr-9 transition-colors',
                            active ? 'bg-accent text-accent-fg' : 'text-fg'
                          )
                        }
                      >
                        {({ selected, active }) => (
                          <>
                            <span className={clsx('block truncate', selected && 'font-semibold')}>
                              {project.name}
                            </span>

                            {selected && (
                              <span
                                className={clsx(
                                  'absolute inset-y-0 right-0 flex items-center pr-4',
                                  active ? 'text-accent-fg' : 'text-accent'
                                )}
                              >
                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))
                  )}
                </Listbox.Options>
              </Transition>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
}
