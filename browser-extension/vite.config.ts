import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Copy extension files to dist after build
function copyExtensionFiles(distDir: string) {
  const filesToCopy = [
    'manifest.json',
    'background.js',
    'content.js',
    'content.css',
  ];

  const dirsToCopy = [
    '_locales',
    'public/icons',
  ];

  // Copy individual files
  for (const file of filesToCopy) {
    const src = path.resolve(__dirname, file);
    const dest = path.resolve(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy directories
  for (const dir of dirsToCopy) {
    const src = path.resolve(__dirname, dir);
    const destName = dir.includes('/') ? path.basename(dir) : dir;
    const dest = path.resolve(distDir, destName);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
  }

  // Rename index.html to popup.html
  const indexHtml = path.resolve(distDir, 'index.html');
  const popupHtml = path.resolve(distDir, 'popup.html');
  if (fs.existsSync(indexHtml)) {
    fs.renameSync(indexHtml, popupHtml);
  }
}

// Plugin to copy extension files after build
function extensionBuildPlugin() {
  return {
    name: 'extension-build',
    closeBundle: () => {
      const distDir = path.resolve(__dirname, 'dist');
      copyExtensionFiles(distDir);
      console.log('✅ Extension files copied to dist/');
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
          '@': path.resolve(__dirname, '.'),
        }
      },
      base: './',
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
          }
        }
      }
    };
});
