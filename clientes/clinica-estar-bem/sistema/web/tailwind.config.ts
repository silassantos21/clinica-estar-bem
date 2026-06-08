import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Magenta/rosa — cor principal da marca (extraída da logo)
        brand: {
          50:  '#FEF1F6',
          100: '#FBDAEC',
          200: '#F7B0D5',
          300: '#F081B7',
          400: '#E04E93',
          500: '#CC2475',
          600: '#C01C63',  // base da logo
          700: '#9A1450',
          800: '#75103D',
          900: '#500B2A',
        },
        // Verde sálvia — cor secundária (espiral da logo)
        sage: {
          50:  '#F0F4F3',
          100: '#DCE7E5',
          200: '#B9CECB',
          300: '#97B5B1',
          400: '#8EA6A0',  // base da logo
          500: '#6D8C86',
          600: '#546E69',
        },
      },
    },
  },
  plugins: [],
}

export default config
