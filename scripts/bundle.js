import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function bundle() {
  try {
    // Bundle worker for Cloudflare Workers
    await esbuild.build({
      entryPoints: [join(rootDir, 'src/worker.ts')],
      bundle: true,
      outfile: join(rootDir, 'dist/worker.js'),
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      minify: false,
      sourcemap: true,
      external: [],
    });

    console.log('✓ Worker bundled successfully');

    // Bundle stdio server for local use
    await esbuild.build({
      entryPoints: [join(rootDir, 'src/index.ts')],
      bundle: true,
      outfile: join(rootDir, 'dist/index.js'),
      format: 'esm',
      platform: 'node',
      target: 'node18',
      minify: false,
      sourcemap: true,
      external: [],
    });

    console.log('✓ Stdio server bundled successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

bundle();
