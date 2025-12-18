import { ThemeProvider as MUIThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize theme from localStorage or system preference
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) return stored;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // Create MUI theme based on current theme
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme,
          ...(theme === 'dark'
            ? {
                background: {
                  default: '#0f172a',
                  paper: '#1e293b',
                },
                text: {
                  primary: '#f1f5f9',
                  secondary: '#94a3b8',
                },
              }
            : {
                background: {
                  default: '#ffffff',
                  paper: '#ffffff',
                },
                text: {
                  primary: '#0f172a',
                  secondary: '#64748b',
                },
              }),
        },
        typography: {
          // Use ONLY bundled Roboto font - no fallbacks prevents font probing
          fontFamily: '"Roboto"',
          // Override all variant font families to prevent MUI defaults
          button: { fontFamily: '"Roboto"' },
          caption: { fontFamily: '"Roboto"' },
          h1: { fontFamily: '"Roboto"' },
          h2: { fontFamily: '"Roboto"' },
          h3: { fontFamily: '"Roboto"' },
          h4: { fontFamily: '"Roboto"' },
          h5: { fontFamily: '"Roboto"' },
          h6: { fontFamily: '"Roboto"' },
          subtitle1: { fontFamily: '"Roboto"' },
          subtitle2: { fontFamily: '"Roboto"' },
          body1: { fontFamily: '"Roboto"' },
          body2: { fontFamily: '"Roboto"' },
          overline: { fontFamily: '"Roboto"' },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiCssBaseline: {
            styleOverrides: {
              '*': {
                fontFamily: '"Roboto" !important',
              },
            },
          },
        },
      }),
    [theme]
  );

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <MUIThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
