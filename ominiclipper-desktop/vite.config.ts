import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Plugin to copy electron CJS files to dist-electron
function electronCopyPlugin() {
  return {
    name: 'electron-copy',
    closeBundle: () => {
      const mainSrc = resolve(__dirname, 'electron/main.cjs');
      const preloadSrc = resolve(__dirname, 'electron/preload.js');
      const httpServerSrc = resolve(__dirname, 'electron/httpServer.cjs');
      const vectorServiceSrc = resolve(__dirname, 'electron/vectorService.cjs');
      const mainDestDir = resolve(__dirname, 'dist-electron/main');
      const preloadDestDir = resolve(__dirname, 'dist-electron/preload');

      if (!existsSync(mainDestDir)) mkdirSync(mainDestDir, { recursive: true });
      if (!existsSync(preloadDestDir)) mkdirSync(preloadDestDir, { recursive: true });

      copyFileSync(mainSrc, resolve(mainDestDir, 'main.cjs'));
      // Copy preload.js as preload.cjs for CommonJS compatibility
      copyFileSync(preloadSrc, resolve(preloadDestDir, 'preload.cjs'));
      // Copy httpServer.cjs for browser extension sync
      if (existsSync(httpServerSrc)) {
        copyFileSync(httpServerSrc, resolve(mainDestDir, 'httpServer.cjs'));
      }
      // Copy vectorService.cjs for vector storage service
      if (existsSync(vectorServiceSrc)) {
        copyFileSync(vectorServiceSrc, resolve(mainDestDir, 'vectorService.cjs'));
      }
      console.log('Electron CJS files copied to dist-electron/');
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isDev = mode === 'development';

  return {
    root: '.',
    base: isDev ? '/' : './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      electronCopyPlugin()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isDev,
    }
  };
});
