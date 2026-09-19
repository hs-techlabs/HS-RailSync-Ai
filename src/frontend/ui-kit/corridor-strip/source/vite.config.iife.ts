import { defineConfig } from 'vite';

/**
 * The served build, matching the other ui-kit modules: one plain <script>
 * file, no bundler, UMD-ish global `CorridorStrip` (plus module.exports for
 * anyone who requires it). GSAP is bundled in so integration is one tag.
 *
 * Written one level up, next to corridor-strip.md and demo.html, which is
 * the folder a page author copies to /static/ui-kit/corridor-strip/.
 */
export default defineConfig({
  build: {
    outDir: '..',
    lib: {
      entry: 'src/index.ts',
      formats: ['umd'],
      name: 'CorridorStrip',
      fileName: () => 'corridor-strip.js',
    },
    rollupOptions: {
      output: { assetFileNames: 'corridor-strip.[ext]' },
    },
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: false,
  },
});
