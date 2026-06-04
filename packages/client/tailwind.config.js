/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border-color)",
        input: "var(--bg-input)",
        ring: "var(--border-focus)",
        background: "var(--bg-app)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--color-primary-500)",
          foreground: "var(--text-on-primary)",
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          900: "var(--color-primary-900)",
        },
        secondary: {
          DEFAULT: "var(--text-secondary)",
          foreground: "var(--color-neutral-50)",
        },
        destructive: {
          DEFAULT: "var(--color-danger-500)",
          foreground: "var(--text-on-danger)",
        },
        muted: {
          DEFAULT: "var(--color-neutral-800)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--color-primary-500)",
          foreground: "var(--color-neutral-50)",
        },
        popover: {
          DEFAULT: "var(--bg-modal)",
          foreground: "var(--text-primary)",
        },
        card: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text-primary)",
          hover: "var(--bg-card-hover)",
        },
        success: {
          DEFAULT: "var(--color-success-500)",
          50: "var(--color-success-50)",
          400: "var(--color-success-400)",
          500: "var(--color-success-500)",
          600: "var(--color-success-600)",
        },
        warning: {
          DEFAULT: "var(--color-warning-500)",
          50: "var(--color-warning-50)",
          400: "var(--color-warning-400)",
          500: "var(--color-warning-500)",
          600: "var(--color-warning-600)",
        },
        danger: {
          DEFAULT: "var(--color-danger-500)",
          50: "var(--color-danger-50)",
          400: "var(--color-danger-400)",
          500: "var(--color-danger-500)",
          600: "var(--color-danger-600)",
        },
        neutral: {
          50: "var(--color-neutral-50)",
          100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)",
          300: "var(--color-neutral-300)",
          400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)",
          600: "var(--color-neutral-600)",
          700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)",
          900: "var(--color-neutral-900)",
          950: "var(--color-neutral-950)",
        }
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
    },
  },
  plugins: [],
}
