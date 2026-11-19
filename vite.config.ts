import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mockMatchServer } from './mockMatchServer';

export default defineConfig({
  plugins: [react(), mockMatchServer()],
});
