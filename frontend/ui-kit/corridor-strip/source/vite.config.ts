import { defineConfig } from 'vite';

/**
 * ESM + CJS build for bundled consumers (the React dashboard).
 * gsap and react stay external so the host app dedupes them.
 */
export default defineConfig({
  build: {
    lib: {
      entry: {
        'corridor-strip': 'src/index.ts',
        react: 'src/react.tsx',
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['gsap', 'react', 'react-dom', 'react/jsx-runtime'],
    },
    cssCodeSplit: false,
    emptyOutDir: true,
    sourcemap: true,
  },
});
