import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// PostCSS plugin to inject font overrides at END of bundle (after library CSS)
// This ensures our overrides win due to CSS cascade order
const fontFingerprintFixPlugin = () => {
  return {
    postcssPlugin: 'font-fingerprint-fix',
    OnceExit(root) {
      // Inject font overrides at the very end
      const overrides = `
/* Font fingerprinting protection - injected at END to override library CSS */
.wmde-markdown,
.w-md-editor,
.w-md-editor *,
.w-md-editor-text,
.w-md-editor-text-input,
.w-md-editor-text-pre,
.w-md-editor-content,
.w-md-editor-input,
.MuiTypography-root,
.MuiButton-root,
.MuiInputBase-root {
  font-family: 'Roboto' !important;
}

.hljs,
.w-md-editor-text-pre code,
.w-md-editor code {
  font-family: 'Consolas', 'Monaco', 'Courier New' !important;
}
`;
      root.append(overrides);
    },
  };
};
fontFingerprintFixPlugin.postcss = true;

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [fontFingerprintFixPlugin()],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@aistudio/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: [
      'aistudio.example.com',
      'vibestudio.example.com',
      'localhost',
      '127.0.0.1',
      '.example.com'
    ],
    hmr: {
      clientPort: 443,
      protocol: 'wss',
      host: 'vibestudio.example.com',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
});
