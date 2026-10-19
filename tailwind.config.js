/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#F4F7F4',
          100: '#E4ECE4',
          200: '#C9D9C9',
          300: '#A4BEA4',
          400: '#759976',
          500: '#2D664E',
          600: '#214C3A', // Primary Forest Green
          700: '#1A3C2E',
          800: '#142E23',
          900: '#0E1F18'
        },
        ivory: {
          50: '#FDFBF7',
          100: '#F5F2E9', // Warm Ivory
          200: '#ECE6D7',
          300: '#DED6C1',
          400: '#C9BEA3'
        },
        sage: {
          50: '#F7FAF6',
          100: '#DDE8D8', // Primary Sage
          200: '#C6D9BE',
          300: '#A8C49D',
          400: '#87AB7A'
        },
        charcoal: {
          50: '#F5F6F4',
          100: '#E6E7E4',
          200: '#CBCCC7',
          500: '#77776C', // Muted Stone
          700: '#474D41',
          800: '#32372C',
          900: '#242820'  // Primary Charcoal
        },
        amber: {
          50: '#FEF9EE',
          100: '#FDF0D5',
          200: '#FBDFA8',
          500: '#D97706',
          600: '#C27803', // Restrained Amber
          700: '#A15E02'
        },
        ruby: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C'  // Editorial Error Red
        },
        // Maintain 'brand' as alias to forest to preserve backwards compatibility
        brand: {
          50: '#F4F7F4',
          100: '#DDE8D8',
          200: '#C9D9C9',
          500: '#2D664E',
          600: '#214C3A',
          700: '#1A3C2E',
          900: '#0E1F18'
        }
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(36, 40, 32, 0.05)',
        card: '0 1px 3px rgba(36, 40, 32, 0.04), 0 6px 24px -4px rgba(36, 40, 32, 0.06)',
        lifted: '0 12px 32px -4px rgba(36, 40, 32, 0.1)'
      }
    }
  },
  plugins: []
};

