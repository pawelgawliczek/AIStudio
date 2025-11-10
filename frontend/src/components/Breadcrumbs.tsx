import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid';
import { useProject } from '../context/ProjectContext';
import clsx from 'clsx';

interface BreadcrumbItem {
  name: string;
  href?: string;
  testId?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumbs({ items = [] }: BreadcrumbsProps) {
  const location = useLocation();
  const { selectedProject } = useProject();

  // Build default breadcrumbs based on current route
  let defaultItems: BreadcrumbItem[] = [
    { name: 'Dashboard', href: '/dashboard', testId: 'breadcrumb-home' },
  ];

  if (selectedProject) {
    defaultItems.push({
      name: selectedProject.name,
      href: `/projects/${selectedProject.id}`,
      testId: 'breadcrumb-project',
    });
  }

  const breadcrumbs = items.length > 0 ? [...defaultItems, ...items] : defaultItems;

  return (
    <nav className="flex" aria-label="Breadcrumb" data-testid="breadcrumbs">
      <ol className="flex items-center space-x-2">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
              )}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className={clsx(
                    'text-sm font-medium hover:text-gray-700',
                    index === 0 ? 'text-gray-500' : 'ml-2 text-gray-500'
                  )}
                  data-testid={item.testId}
                >
                  {index === 0 ? (
                    <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    item.name
                  )}
                </Link>
              ) : (
                <span
                  className={clsx(
                    'text-sm font-medium',
                    isLast ? 'text-gray-700' : 'text-gray-500',
                    index > 0 && 'ml-2'
                  )}
                  data-testid={item.testId}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {index === 0 && !item.href ? (
                    <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    item.name
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
