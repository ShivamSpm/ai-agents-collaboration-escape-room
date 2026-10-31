import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { voiceServer } from './voice-server.ts'

// Vite on 5173; /api goes to Person A's server on 3001 (see TEAM.md "Ports").
// /voice/* (agent voices, push-to-talk) is served by this dev server; see voice-server.ts.
export default defineConfig({
  plugins: [react(), tailwindcss(), voiceServer()],
  server: {
    port: 5173,
    strictPort: true,
    // web/ imports ../shared
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:3001' },
  },
})
