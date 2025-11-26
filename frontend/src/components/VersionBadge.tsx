import { FC } from 'react';

export interface VersionBadgeProps {
  version: string;
  status?: 'current' | 'previous' | 'major';
  size?: 'sm' | 'md' | 'lg';
  onClick?: (version: string) => void;
  className?: string;
  'aria-label'?: string;
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const statusClasses = {
  current: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  previous: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  major: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

/**
 * VersionBadge - Color-coded badge to display entity versions
 *
 * @example
 * ```tsx
 * <VersionBadge version="v1.5" status="current" size="md" />
 * <VersionBadge version="v2.0" status="major" size="lg" onClick={handleClick} />
 * ```
 */
export const VersionBadge: FC<VersionBadgeProps> = ({
  version,
  status = 'current',
  size = 'md',
  onClick,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(version);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(version);
    }
  };

  const baseClasses = 'inline-flex items-center rounded-full font-medium';
  const interactiveClasses = onClick
    ? 'cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
    : '';

  const combinedClasses = [
    baseClasses,
    sizeClasses[size],
    statusClasses[status],
    interactiveClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const defaultAriaLabel = ariaLabel || `${status} version ${version}`;

  return (
    <span
      className={combinedClasses}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={defaultAriaLabel}
    >
      {version}
    </span>
  );
};
