import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          950: '#082F49'
        },
        journal: {
          50: '#FAF6F0',
          100: '#F3ECE2',
          200: '#E7DDD0',
          800: '#292524',
          900: '#1C1917'
        }
      },
      fontFamily: {
        sans: [
          '"Noto Sans TC"',
          '"Noto Sans CJK TC"',
          '"Source Han Sans TC"',
          '"Source Han Sans"',
          '"思源黑體"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        body: [
          '"Noto Sans TC"',
          '"Noto Sans CJK TC"',
          '"Source Han Sans TC"',
          '"Source Han Sans"',
          '"思源黑體"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        'heading-lg': [
          '"Alibaba PuHuiTi 3.0"',
          '"Alibaba PuHuiTi"',
          '"AlibabaPuHuiTi"',
          '"阿里巴巴普惠體"',
          '"Noto Sans TC"',
          'sans-serif'
        ],
        'heading-md': [
          '"Noto Sans TC"',
          '"Noto Sans CJK TC"',
          '"Source Han Sans TC"',
          '"Source Han Sans"',
          '"思源黑體"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        'heading-sm': [
          '"Noto Sans TC"',
          '"Noto Sans CJK TC"',
          '"Source Han Sans TC"',
          '"Source Han Sans"',
          '"思源黑體"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        en: ['"Zen Maru Gothic"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      borderRadius: {
        bento: '24px',
        module: '16px',
        block: 'var(--block-radius, 16px)',
        surface: 'var(--card-radius, 24px)'
      }
    }
  },
  plugins: []
};

export default config;
