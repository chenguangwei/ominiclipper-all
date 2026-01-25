import { defineConfig } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    entry: 'electron/main.js',
    outDir: 'dist-electron/main',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'electron')
      }
    }
  },
  preload: {
    entry: 'electron/preload.js',
    outDir: 'dist-electron/preload',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'electron')
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist'
    }
  }
});
