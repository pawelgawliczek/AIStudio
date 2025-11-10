import React, { Fragment, useState } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { useProject } from '../context/ProjectContext';
import clsx from 'clsx';

export function ProjectSelector() {
  const { projects, selectedProject, setSelectedProject, isLoading } = useProject();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="w-72" data-testid="project-selector">
        <div className="animate-pulse bg-gray-200 h-10 rounded"></div>
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
                className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                data-testid="project-dropdown"
              >
                <span className="block truncate">
                  {selectedProject ? selectedProject.name : 'Select a project'}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>

              <Transition
                show={open}
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {/* Search input */}
                  <div className="sticky top-0 bg-white px-3 py-2 border-b border-gray-200">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        className="w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid="project-search"
                      />
                    </div>
                  </div>

                  {filteredProjects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No projects found</div>
                  ) : (
                    filteredProjects.map((project) => (
                      <Listbox.Option
                        key={project.id}
                        value={project}
                        data-testid={`project-option-${project.id}`}
                        className={({ active }) =>
                          clsx(
                            'relative cursor-pointer select-none py-2 pl-3 pr-9',
                            active ? 'bg-indigo-600 text-white' : 'text-gray-900'
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
                                  active ? 'text-white' : 'text-indigo-600'
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
