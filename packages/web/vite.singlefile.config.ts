import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One-off config to produce a single self-contained HTML file (JS/CSS inlined),
// used only to preview single-player mode as a shareable artifact. Not used
// for the normal dev/production build.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-singlefile',
  },
});
