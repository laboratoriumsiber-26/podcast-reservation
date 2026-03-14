import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // base: '/podcast-reservation/' wajib ada supaya GitHub Pages nggak blank
  base: '/podcast-reservation/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Mengarahkan alias @ ke folder src agar import komponen aman
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Settingan server/env dihapus total agar tidak menyebabkan Sync Error
});