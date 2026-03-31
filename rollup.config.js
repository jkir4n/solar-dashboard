import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/solar-dashboard.js',
  output: {
    file: 'dist/solar-dashboard.js',
    format: 'es',
    inlineDynamicImports: true,
  },
  plugins: [
    resolve(),
    terser({
      output: { comments: false },
    }),
  ],
};
