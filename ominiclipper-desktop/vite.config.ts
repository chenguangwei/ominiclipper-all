import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { resolve } from 'path';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { builtinModules } from 'module';

// Check if we should skip Electron plugin (when running with external Electron)
const skipElectron = process.env.SKIP_ELECTRON === 'true';

// Plugin to copy PDF.js worker to dist folder
function pdfWorkerCopyPlugin() {
  return {
    name: 'pdf-worker-copy',
    closeBundle: () => {
      const pdfWorkerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const pdfWorkerDest = resolve(__dirname, 'dist/pdf.worker.min.mjs');

      if (existsSync(pdfWorkerSrc)) {
        if (!existsSync(resolve(__dirname, 'dist'))) {
          // checking just in case, though build usually creates it
        }
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
// Plugin to remove export default from electron builds (fixes syntax error in CJS)
function removeExportDefaultPlugin() {
  return {
    name: 'remove-export-default',
    writeBundle(options: any, bundle: any) {
      for (const fileName in bundle) {
        if (fileName.endsWith('.cjs')) {
          const filePath = resolve(options.dir, fileName);
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf-8');
            if (content.includes('export default')) {
              const newContent = content.replace(/export default.*;\s*$/, '').replace(/export default.*;/g, '');
              writeFileSync(filePath, newContent);
              console.log(`Removed export default from ${fileName}`);
            }
          }
        }
      }
    }
  };
}

// Plugin to copy additional .cjs files needed by electron main process
function copyElectronCjsPlugin() {
  return {
    name: 'copy-electron-cjs',
    closeBundle: () => {
      const electronDir = resolve(__dirname, 'electron');
      const distDir = resolve(__dirname, 'dist-electron/main');

      if (!existsSync(distDir)) {
        console.warn('dist-electron/main directory does not exist, skipping CJS copy');
        return;
      }

      // Files to copy from electron directory
      const filesToCopy = [
        'textChunker.cjs',
        'httpServer.cjs',
        'embeddingModels.cjs',
        'searchIndexManager.cjs',
        'vectorService.cjs',
        'chunkingService.cjs',
        'tokenizer.cjs',
      ];

      for (const fileName of filesToCopy) {
        const srcPath = resolve(electronDir, fileName);
        const destPath = resolve(distDir, fileName);

        if (existsSync(srcPath)) {
          copyFileSync(srcPath, destPath);
          console.log(`Copied ${fileName} to dist-electron/main/`);
        } else {
          console.warn(`File not found: ${srcPath}`);
        }
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isDev = mode === 'development';

  return {
    root: '.',
    base: './', // Electron mostly works with relative paths
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // Only load electron plugin when not skipping (i.e., not running with external Electron)
      ...(skipElectron ? [] : [
        electron([
          {
            // Main-Process entry file
            entry: 'electron/main/index.ts',
            onstart(options) {
              options.startup()
            },
            vite: {
              plugins: [removeExportDefaultPlugin(), copyElectronCjsPlugin()],
              build: {
                sourcemap: isDev,
                minify: isDev ? false : 'esbuild',
                outDir: 'dist-electron/main',
                lib: {
                  entry: 'electron/main/index.ts',
                  formats: ['cjs'],
                  fileName: () => 'main.cjs',
                },
                rollupOptions: {
                  external: ['electron', ...builtinModules],
                },
              },
            },
          },
          {
            entry: 'electron/preload/index.ts',
            onstart(options) {
              // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
              // instead of restarting the entire Electron App.
              options.reload()
            },
            vite: {
              plugins: [removeExportDefaultPlugin()],
              build: {
                sourcemap: isDev ? 'inline' : undefined,
                minify: isDev ? false : 'esbuild',
                outDir: 'dist-electron/preload',
                rollupOptions: {
                  external: ['electron', ...builtinModules],
                  output: {
                    entryFileNames: 'preload.cjs',
                    format: 'cjs',
                    inlineDynamicImports: true,
                    // Force the code to execute immediately
                    strict: false,
                  }
                },
              },
            },
          }
        ])
      ]),
      pdfWorkerCopyPlugin(),
      ...(isDev ? [pdfWorkerDevPlugin()] : [])
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // NODE_ENV is automatically handled, but we can preserve if needed
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'utils': path.resolve(__dirname, './src/utils'),
        'hooks': path.resolve(__dirname, './src/hooks'),
        'types': path.resolve(__dirname, './src/types'),
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isDev,
    }
  };
});
