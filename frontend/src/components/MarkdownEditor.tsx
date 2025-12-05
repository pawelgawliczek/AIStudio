import { useMemo, useCallback } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import { useTheme } from '../context/ThemeContext';
import 'easymde/dist/easymde.min.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  minHeight?: number;
  className?: string;
  name?: string;
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

  const options = useMemo(() => ({
    spellChecker: false,
    placeholder,
    minHeight: `${minHeight}px`,
    status: false,
    toolbar: [
      'bold',
      'italic',
      'heading',
      '|',
      'quote',
      'unordered-list',
      'ordered-list',
      '|',
      'link',
      'image',
      '|',
      'preview',
      'side-by-side',
      'fullscreen',
      '|',
      'guide',
    ],
  }), [placeholder, minHeight]);

  const handleChange = useCallback((value: string) => {
    onChange(value);
  }, [onChange]);

  return (
    <div className={`markdown-editor-wrapper ${className}`} data-color-mode={theme}>
      <SimpleMDE
        value={value}
        onChange={handleChange}
        options={options}
      />
      <style>{`
        /* Override SimpleMDE/EasyMDE fonts - use ONLY Roboto */
        .markdown-editor-wrapper .EasyMDEContainer,
        .markdown-editor-wrapper .CodeMirror,
        .markdown-editor-wrapper .CodeMirror *,
        .markdown-editor-wrapper .editor-toolbar,
        .markdown-editor-wrapper .editor-toolbar *,
        .markdown-editor-wrapper .editor-preview,
        .markdown-editor-wrapper .editor-preview * {
          font-family: 'Roboto', sans-serif !important;
        }

        /* Theme integration */
        .markdown-editor-wrapper .CodeMirror {
          background-color: var(--bg) !important;
          color: var(--fg) !important;
          border: 1px solid var(--border) !important;
          border-radius: 0.375rem !important;
          height: ${height}px !important;
        }

        .markdown-editor-wrapper .editor-toolbar {
          background-color: var(--bg-secondary) !important;
          border: 1px solid var(--border) !important;
          border-bottom: none !important;
        }

        .markdown-editor-wrapper .editor-toolbar button {
          color: var(--fg) !important;
        }

        .markdown-editor-wrapper .editor-toolbar button:hover {
          background-color: var(--accent) !important;
          color: var(--accent-fg) !important;
        }

        .markdown-editor-wrapper .editor-toolbar.disabled-for-preview button:not(.no-disable) {
          opacity: 0.6 !important;
        }

        .markdown-editor-wrapper .CodeMirror-cursor {
          border-left-color: var(--fg) !important;
        }

        .markdown-editor-wrapper .CodeMirror-selected {
          background-color: var(--accent) !important;
          opacity: 0.3 !important;
        }

        .markdown-editor-wrapper .editor-preview {
          background-color: var(--bg) !important;
          color: var(--fg) !important;
        }
      `}</style>
    </div>
  );
}
