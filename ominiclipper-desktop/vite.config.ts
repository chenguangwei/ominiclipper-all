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
      const textChunkerSrc = resolve(__dirname, 'electron/textChunker.cjs');
      const searchIndexManagerSrc = resolve(__dirname, 'electron/searchIndexManager.cjs');
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
      // Copy textChunker.cjs for text chunking
      if (existsSync(textChunkerSrc)) {
        copyFileSync(textChunkerSrc, resolve(mainDestDir, 'textChunker.cjs'));
      }
      // Copy searchIndexManager.cjs for BM25 search
      if (existsSync(searchIndexManagerSrc)) {
        copyFileSync(searchIndexManagerSrc, resolve(mainDestDir, 'searchIndexManager.cjs'));
      }
      console.log('Electron CJS files copied to dist-electron/');
    }
  };
}

// Plugin to copy PDF.js worker to dist folder
function pdfWorkerCopyPlugin() {
  return {
    name: 'pdf-worker-copy',
    closeBundle: () => {
      const pdfWorkerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const pdfWorkerDest = resolve(__dirname, 'dist/pdf.worker.min.mjs');

      if (existsSync(pdfWorkerSrc)) {
        copyFileSync(pdfWorkerSrc, pdfWorkerDest);
        console.log('PDF.js worker copied to dist/');
      } else {
        console.warn('PDF.js worker not found at:', pdfWorkerSrc);
      }
    }
  };
}

// Plugin to serve PDF worker in dev mode from node_modules
function pdfWorkerDevPlugin() {
  return {
    name: 'pdf-worker-dev',
    configureServer(server: any) {
      // Handle PDF worker requests in development mode
      server.middlewares.use('/pdf.worker.min.mjs', (req: any, res: any, next: any) => {
        const pdfWorkerPath = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
        if (existsSync(pdfWorkerPath)) {
          const fs = require('fs');
          res.setHeader('Content-Type', 'application/javascript');
          fs.createReadStream(pdfWorkerPath).pipe(res);
        } else {
          next();
        }
      });
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
      electronCopyPlugin(),
      pdfWorkerCopyPlugin(),
      ...(isDev ? [pdfWorkerDevPlugin()] : [])
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'utils': path.resolve(__dirname, 'utils'),
        'hooks': path.resolve(__dirname, 'hooks'),
        'types': path.resolve(__dirname, 'types'),
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isDev,
    }
  };
});
