/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#4f46e5', dark: '#4338ca', soft: '#eef0fe' },
        ink: '#101828',
        subtle: '#667085',
        line: '#e7ebf3',
        page: '#f4f6fb',
        ok: { DEFAULT: '#12b76a', soft: '#e7f8f0' },
        warn: { DEFAULT: '#d97706', soft: '#fdf3e4' },
        info: { DEFAULT: '#0ea5e9', soft: '#e7f5fd' },
        danger: { DEFAULT: '#e11d48', soft: '#fdecef' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.05)',
        pop: '0 12px 32px -8px rgba(16, 24, 40, 0.18)',
      },
      keyframes: {
        fade: { from: { opacity: '0' } },
        pop: { from: { opacity: '0', transform: 'scale(0.96) translateY(6px)' } },
      },
      animation: {
        fade: 'fade 0.15s ease',
        pop: 'pop 0.18s ease',
      },
    },
  },
  plugins: [],
}
