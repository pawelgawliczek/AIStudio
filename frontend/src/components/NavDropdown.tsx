import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  icon?: string;
}

interface NavDropdownProps {
  label: string;
  icon?: string;
  items: NavItem[];
}

export function NavDropdown({ label, icon, items }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-1 pt-1 text-sm font-medium text-fg hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-card border border-border z-50"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="py-1">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-fg hover:bg-accent/10 hover:text-accent transition-colors"
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
