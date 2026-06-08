/**
 * Talaat Market — Enterprise Craftsmanship Theme Constants
 * 
 * Safe TypeScript representations of CSS design tokens to use in inline
 * styles, canvas rendering, charting libraries, or programmatic styling.
 */

export const COLORS = {
  background: {
    app: 'var(--bg-app)',
    sidebar: 'var(--bg-sidebar)',
    header: 'var(--bg-header)',
    card: 'var(--bg-card)',
    cardHover: 'var(--bg-card-hover)',
    input: 'var(--bg-input)',
    modal: 'var(--bg-modal)',
    tooltip: 'var(--bg-tooltip)',
  },
  border: {
    color: 'var(--border-color)',
    focus: 'var(--border-focus)',
    active: 'var(--border-active)',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
    onPrimary: 'var(--text-on-primary)',
    onDanger: 'var(--text-on-danger)',
    success: 'var(--text-success)',
    warning: 'var(--text-warning)',
    danger: 'var(--text-danger)',
  },
  brand: {
    50: 'var(--color-primary-50)',
    100: 'var(--color-primary-100)',
    200: 'var(--color-primary-200)',
    400: 'var(--color-primary-400)',
    500: 'var(--color-primary-500)',
    600: 'var(--color-primary-600)',
    700: 'var(--color-primary-700)',
    900: 'var(--color-primary-900)',
  },
  success: {
    50: 'var(--color-success-50)',
    400: 'var(--color-success-400)',
    500: 'var(--color-success-500)',
    600: 'var(--color-success-600)',
  },
  warning: {
    50: 'var(--color-warning-50)',
    400: 'var(--color-warning-400)',
    500: 'var(--color-warning-500)',
    600: 'var(--color-warning-600)',
  },
  danger: {
    50: 'var(--color-danger-50)',
    400: 'var(--color-danger-400)',
    500: 'var(--color-danger-500)',
    600: 'var(--color-danger-600)',
  },
  neutral: {
    0: 'var(--color-neutral-0)',
    50: 'var(--color-neutral-50)',
    100: 'var(--color-neutral-100)',
    200: 'var(--color-neutral-200)',
    300: 'var(--color-neutral-300)',
    400: 'var(--color-neutral-400)',
    500: 'var(--color-neutral-500)',
    600: 'var(--color-neutral-600)',
    700: 'var(--color-neutral-700)',
    800: 'var(--color-neutral-800)',
    850: 'var(--color-neutral-850)',
    900: 'var(--color-neutral-900)',
    950: 'var(--color-neutral-950)',
  },
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    sans: 'var(--font-sans)',
    arabic: 'var(--font-arabic)',
    mono: 'var(--font-mono)',
  },
  fontSize: {
    xs: 'var(--text-xs)',     // 12px
    sm: 'var(--text-sm)',     // 14px
    base: 'var(--text-base)', // 16px
    lg: 'var(--text-lg)',     // 18px
    xl: 'var(--text-xl)',     // 20px
    xxl: 'var(--text-2xl)',   // 24px
    xxxl: 'var(--text-3xl)',  // 30px
    xxxxl: 'var(--text-4xl)', // 36px
  },
  fontWeight: {
    normal: 'var(--font-normal)',
    medium: 'var(--font-medium)',
    semibold: 'var(--font-semibold)',
    bold: 'var(--font-bold)',
  },
  lineHeight: {
    tight: 'var(--leading-tight)',
    normal: 'var(--leading-normal)',
    relaxed: 'var(--leading-relaxed)',
  },
} as const;

export const SPACING = {
  0: 'var(--space-0)',
  1: 'var(--space-1)',  // 4px
  2: 'var(--space-2)',  // 8px
  3: 'var(--space-3)',  // 12px
  4: 'var(--space-4)',  // 16px
  5: 'var(--space-5)',  // 20px
  6: 'var(--space-6)',  // 24px
  8: 'var(--space-8)',  // 32px
  10: 'var(--space-10)',// 40px
  12: 'var(--space-12)',// 48px
  16: 'var(--space-16)',// 64px
} as const;

export const RADIUS = {
  sm: 'var(--radius-sm)', // 2px
  md: 'var(--radius-md)', // 4px
  lg: 'var(--radius-lg)', // 6px
  xl: 'var(--radius-xl)', // 8px
  full: 'var(--radius-full)',
} as const;

export const MOTION = {
  transition: {
    instant: 'var(--transition-instant)',
    fast: 'var(--transition-fast)',
    base: 'var(--transition-base)',
    slow: 'var(--transition-slow)',
  },
} as const;

export const Z_INDEX = {
  base: 'var(--z-base)',
  dropdown: 'var(--z-dropdown)',
  sticky: 'var(--z-sticky)',
  modal: 'var(--z-modal)',
  toast: 'var(--z-toast)',
  tooltip: 'var(--z-tooltip)',
} as const;
