import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';

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
  const defaultItems: BreadcrumbItem[] = [
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
      <ol className="flex items-center gap-2">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-muted" aria-hidden="true" />
              )}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className={clsx(
                    'text-sm font-medium text-muted hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded',
                    index > 0 && 'ml-2'
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
                    isLast ? 'text-fg' : 'text-muted',
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
