import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4031,
    strictPort: true
  },
  preview: {
    port: 4031,
    strictPort: true
  }
});
