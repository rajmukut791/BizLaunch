import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/socket.io': { target: process.env.BIZLAUNCH_API_URL || 'http://localhost:5000', ws: true },
      '/api': process.env.BIZLAUNCH_API_URL || 'http://localhost:5000',
      '/uploads': process.env.BIZLAUNCH_API_URL || 'http://localhost:5000',
      '/demo': process.env.BIZLAUNCH_API_URL || 'http://localhost:5000',
    },
  },
});
