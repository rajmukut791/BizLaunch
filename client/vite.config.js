import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.BIZLAUNCH_API_URL || 'http://localhost:5000',
      '/uploads': process.env.BIZLAUNCH_API_URL || 'http://localhost:5000',
      '/demo': process.env.BIZLAUNCH_API_URL || 'http://localhost:5000',
    },
  },
});
