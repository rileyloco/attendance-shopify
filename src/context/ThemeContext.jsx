// src/context/ThemeContext.jsx
import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

// Midnight Glass theme
export const theme = {
  name: 'Midnight Glass',
  colors: {
    // Dark blue gradient background
    bgPrimary: '#1a1a2e',
    bgSecondary: '#16213e',
    bgTertiary: '#0f3460',
    
    // Glass effects
    glassBg: 'rgba(255, 255, 255, 0.05)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassHover: 'rgba(255, 255, 255, 0.08)',
    
    // Text colors
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.85)',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    
    // Accent colors
    accentWarm: '#ff6b35',
    accentGold: '#ffd23f',
    accentCoral: '#ff8e9b',
    accentTeal: '#54c6eb',
    
    // Status colors
    success: '#4ecdc4',
    warning: '#ffe66d',
    
    // For compatibility with existing components
    background: '#1a1a2e',
    foreground: '#ffffff',
    card: 'rgba(255, 255, 255, 0.05)',
    cardForeground: '#ffffff',
    primary: '#ff6b35',
    primaryForeground: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.05)',
    secondaryForeground: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.05)',
    mutedForeground: 'rgba(255, 255, 255, 0.6)',
    accent: 'rgba(255, 255, 255, 0.08)',
    accentForeground: '#ffffff',
    destructive: '#ff6b35',
    destructiveForeground: '#ffffff',
    border: 'rgba(255, 255, 255, 0.1)',
    input: 'rgba(255, 255, 255, 0.05)',
    ring: '#ff6b35',
  }
};

export function ThemeProvider({ children }) {
  // Apply theme on mount
  useEffect(() => {
    applyTheme();
  }, []);

  // Apply theme to CSS variables
  function applyTheme() {
    const root = document.documentElement;
    
    // Apply all color variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });
    
    // Apply compatibility variables
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-foreground', theme.colors.foreground);
    root.style.setProperty('--color-card', theme.colors.card);
    root.style.setProperty('--color-card-foreground', theme.colors.cardForeground);
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-primary-foreground', theme.colors.primaryForeground);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-secondary-foreground', theme.colors.secondaryForeground);
    root.style.setProperty('--color-muted', theme.colors.muted);
    root.style.setProperty('--color-muted-foreground', theme.colors.mutedForeground);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-accent-foreground', theme.colors.accentForeground);
    root.style.setProperty('--color-destructive', theme.colors.destructive);
    root.style.setProperty('--color-destructive-foreground', theme.colors.destructiveForeground);
    root.style.setProperty('--color-border', theme.colors.border);
    root.style.setProperty('--color-input', theme.colors.input);
    root.style.setProperty('--color-ring', theme.colors.ring);
    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-warning', theme.colors.warning);
  }

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}