import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to handle post-build tasks
function extensionBuildPlugin() {
  return {
    name: 'extension-build',
    closeBundle: () => {
      const distDir = path.resolve(__dirname, 'dist');

      // Copy _locales if exists
      const localesDir = path.resolve(__dirname, '_locales');
      const distLocalesDir = path.resolve(distDir, '_locales');
      if (fs.existsSync(localesDir)) {
        fs.cpSync(localesDir, distLocalesDir, { recursive: true, force: true });
      }

      // Move popup.html from dist/src/popup/index.html to dist/popup.html
      const popupSrcPath = path.resolve(distDir, 'src/popup/index.html');
      const popupDestPath = path.resolve(distDir, 'popup.html');
      if (fs.existsSync(popupSrcPath)) {
        // Read and update paths in HTML
        let htmlContent = fs.readFileSync(popupSrcPath, 'utf-8');
        // Fix JS path (from ../../popup.js to ./popup.js)
        htmlContent = htmlContent.replace(/src="\.\.\/\.\.\/popup\.js"/g, 'src="./popup.js"');
        // Fix CSS path (from ../assets/ to ./assets/)
        htmlContent = htmlContent.replace(/href="\.\.\/assets\//g, 'href="./assets/');
        htmlContent = htmlContent.replace(/href="\.\.\/\.\.\/assets\//g, 'href="./assets/');
        fs.writeFileSync(popupDestPath, htmlContent);
        console.log('[extension-build] Moved popup.html to dist root');
      }

      // Copy content.css to dist root
      const contentCssSrc = path.resolve(__dirname, 'src/content/content.css');
      const contentCssDest = path.resolve(distDir, 'content.css');
      if (fs.existsSync(contentCssSrc)) {
        fs.copyFileSync(contentCssSrc, contentCssDest);
        console.log('[extension-build] Copied content.css to dist root');
      }

      // Clean up src folder in dist (it's no longer needed)
      const distSrcDir = path.resolve(distDir, 'src');
      if (fs.existsSync(distSrcDir)) {
        fs.rmSync(distSrcDir, { recursive: true, force: true });
        console.log('[extension-build] Cleaned up dist/src folder');
      }
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
          assetFileNames: 'assets/[name].[ext]',
        }
      }
    }
  };
});
