/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-out forwards',
        'fadeInUp': 'fadeInUp 0.4s ease-out forwards',
        'slideDown': 'slideDown 0.3s ease-out forwards',
        'scaleIn': 'scaleIn 0.2s ease-out forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
