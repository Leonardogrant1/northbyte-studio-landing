import esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import path from 'path';
import { fileURLToPath } from 'url';
import { TsconfigPathsPlugin } from "@esbuild-plugins/tsconfig-paths";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  plugins: [
    TsconfigPathsPlugin({ tsconfig: path.resolve(__dirname, "tsconfig.json") }),
    nodeExternalsPlugin()
  ],
}).catch(() => process.exit(1));





