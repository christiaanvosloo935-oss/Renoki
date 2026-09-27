/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Reading Room palette — warm, editorial, image-forward
        paper: '#FBF8F2',    // cream page background
        ivory: '#FBF8F2',    // alias (existing code uses `bg-ivory`)
        ink: '#1C2422',      // primary text
        espresso: '#1C2422', // alias (existing code)
        muted: '#6B6558',
        line: '#E4DFD3',     // hairlines / borders
        teal: {
          DEFAULT: '#1C6E62',
          dark: '#123F38',
          light: '#DCEEEA',
        },
        terracotta: '#C25B3F', // accent for hovers/CTAs
        gold: {
          DEFAULT: '#C9962C',
          light: '#F4E6C4',
          soft: '#F4E6C4',   // alias for ::selection
        },
      },
      fontFamily: {
        display: ['"Newsreader"', 'Georgia', 'serif'],
        serif: ['"Newsreader"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        reader: '38rem',    // long-form comfortable line length
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,36,34,0.04), 0 8px 24px rgba(28,36,34,0.06)',
      },
    },
  },
  plugins: [],
}
