import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite on 5173; /api goes to Person A's server on 3001 (see TEAM.md "Ports").
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // web/ imports ../shared
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:3001' },
  },
})
