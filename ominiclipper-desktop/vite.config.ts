import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

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
      electron([
        {
          entry: 'electron/main.js',
          vite: {
            build: {
              outDir: 'dist-electron/main'
            }
          }
        },
        {
          entry: 'electron/preload.js',
          vite: {
            build: {
              outDir: 'dist-electron/preload'
            }
          }
        }
      ])
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
