import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O base './' garante compatibilidade tanto em dominio raiz quanto em subpasta do GitHub Pages (/compras-emc-ufsc/)
export default defineConfig({
  plugins: [react()],
  base: './',
});
