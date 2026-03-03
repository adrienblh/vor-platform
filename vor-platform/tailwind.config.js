/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        body: ['IBM Plex Sans', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f5f4f0',
          100: '#e8e6de',
          200: '#cdc9bb',
          300: '#b0aa97',
          400: '#928b74',
          500: '#786f58',
          600: '#5e5644',
          700: '#443e30',
          800: '#2a271e',
          900: '#15130d',
          950: '#0a0905',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        rust: {
          400: '#ef7c45',
          500: '#e05e28',
          600: '#c44d1e',
        },
        sage: {
          400: '#84a89c',
          500: '#5f8a7b',
          600: '#466b5f',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
