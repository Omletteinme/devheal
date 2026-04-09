import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/mcp.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  clean: true,
  dts: false,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
