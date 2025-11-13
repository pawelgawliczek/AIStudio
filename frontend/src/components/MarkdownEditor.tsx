import { useEffect, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from '../context/ThemeContext';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  minHeight?: number;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Enter text here... Markdown is supported.',
  height = 200,
  minHeight = 150,
  className = '',
}: MarkdownEditorProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent SSR issues with the markdown editor
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`rounded-md border border-border bg-bg p-4 ${className}`}
        style={{ minHeight: `${minHeight}px` }}
      >
        <span className="text-muted">Loading editor...</span>
      </div>
    );
  }

  return (
    <div className={`markdown-editor-wrapper ${className}`} data-color-mode={theme}>
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview="edit"
        textareaProps={{
          placeholder: placeholder,
        }}
        style={{
          borderRadius: '0.375rem',
          border: `1px solid var(--border)`,
          backgroundColor: 'var(--bg)',
          color: 'var(--fg)',
        }}
      />
      <style>{`
        .markdown-editor-wrapper .w-md-editor {
          background-color: var(--bg) !important;
          color: var(--fg) !important;
        }

        .markdown-editor-wrapper .w-md-editor-toolbar {
          background-color: var(--bg-secondary) !important;
          border-bottom: 1px solid var(--border) !important;
        }

        .markdown-editor-wrapper .w-md-editor-toolbar button {
          color: var(--fg) !important;
        }

        .markdown-editor-wrapper .w-md-editor-toolbar button:hover {
          background-color: var(--accent) !important;
          color: var(--accent-fg) !important;
        }

        .markdown-editor-wrapper .w-md-editor-text-pre,
        .markdown-editor-wrapper .w-md-editor-text-input,
        .markdown-editor-wrapper .w-md-editor-text {
          background-color: var(--bg) !important;
          color: var(--fg) !important;
        }

        .markdown-editor-wrapper .w-md-editor-text-input::placeholder {
          color: var(--muted) !important;
        }

        .markdown-editor-wrapper .w-md-editor-preview {
          background-color: var(--bg) !important;
          color: var(--fg) !important;
        }

        [data-color-mode="dark"] .markdown-editor-wrapper .w-md-editor {
          --md-editor-background-color: var(--bg) !important;
          --md-editor-color: var(--fg) !important;
        }
      `}</style>
    </div>
  );
}
