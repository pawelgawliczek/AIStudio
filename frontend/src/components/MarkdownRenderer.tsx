import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer component for rendering markdown content with proper styling.
 * Supports common markdown features including headers, lists, code blocks, links, etc.
 * Styling is consistent with the application's design system and works in both light and dark modes.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={clsx(
        'prose prose-sm max-w-none',
        // Text colors for light/dark mode
        'prose-headings:text-fg prose-p:text-muted prose-strong:text-fg',
        'prose-code:text-fg prose-pre:bg-secondary prose-pre:text-fg',
        'prose-li:text-muted prose-a:text-accent hover:prose-a:text-accent-dark',
        'prose-blockquote:text-muted prose-blockquote:border-l-accent',
        'prose-hr:border-border',
        // Code blocks styling
        'prose-pre:border prose-pre:border-border prose-pre:rounded-lg',
        // Table styling
        'prose-table:border prose-table:border-border',
        'prose-th:bg-secondary prose-th:text-fg',
        'prose-td:border prose-td:border-border',
        // List styling
        'prose-ul:text-muted prose-ol:text-muted',
        // Additional customization
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
