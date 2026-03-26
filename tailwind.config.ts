import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        seazone: {
          blue: '#0055FF',
          navy: '#00143D',
          coral: '#FC6058',
          light: '#E8EFFE',
          medium: '#6593FF',
          deep: '#00247A',
          royal: '#0048D7',
          dark: '#2E2E2E',
          grey: '#7C7C7C',
        },
      },
    },
  },
  plugins: [],
}
export default config
