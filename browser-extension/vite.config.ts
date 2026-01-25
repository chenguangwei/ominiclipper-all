import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to handle post-build tasks (copying _locales, renaming popup)
function extensionBuildPlugin() {
  return {
    name: 'extension-build',
    closeBundle: () => {
      const distDir = path.resolve(__dirname, 'dist');

      // Copy _locales if exists (public directory handled by Vite automatically)
      const localesDir = path.resolve(__dirname, '_locales');
      const distLocalesDir = path.resolve(distDir, '_locales');
      if (fs.existsSync(localesDir)) {
        fs.cpSync(localesDir, distLocalesDir, { recursive: true, force: true });
      }

      // Rename index.html from src/popup/index.html build to popup.html if needed,
      // but if we key it as 'popup' in input, it might output as popup.html or src/popup/index.html.
      // Easiest is to let it be what it is and ensure manifest matches, OR flattened.
      // For now, let's keep it simple.
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), extensionBuildPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    base: './', // Relative paths for extension
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          popup: path.resolve(__dirname, 'src/popup/index.html'),
          background: path.resolve(__dirname, 'src/background/index.ts'),
          content: path.resolve(__dirname, 'src/content/index.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name].[ext]', // Remove hash for stable filenames if needed for content.css
        }
      }
    }
  };
});
