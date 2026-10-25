import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const port = Number(process.env.DASHBOARD_PORT ?? 5173);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port,
    strictPort: true,
    // Design-process notes live beside the app and must never be served to a browser.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.impeccable/**'] },
  },
  preview: { port, strictPort: true },
});
