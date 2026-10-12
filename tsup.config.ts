import { defineConfig } from 'tsup';

const strategies = [
  'percent', 'power', 'fluid', 'auto', 'diagonal', 'fill', 'fit',
  'interpolated', 'logarithmic', 'perimeter', 'density',
];

const entry: Record<string, string> = {
  index: 'src/index.ts',
  resize: 'src/resize.ts',
  units: 'src/units.ts',
  postcss: 'src/postcss.ts',
  react: 'src/react.ts',
  vue: 'src/vue.ts',
  svelte: 'src/svelte.ts',
  angular: 'src/angular.ts',
};
for (const s of strategies) entry[s] = `src/${s}.ts`;

export default defineConfig([
  {
    entry,
    format: ['esm', 'cjs'],
    dts: true,
    splitting: true,
    treeshake: true,
    sourcemap: false,
    target: 'es2020',
    external: ['react', 'vue', '@angular/core'],
  },
  {
    entry: { 'webdimens.global': 'src/global.ts', 'webdimens.lite.global': 'src/lite.ts' },
    format: ['iife'],
    minify: true,
    sourcemap: true,
    target: 'es2018',
    outExtension: () => ({ js: '.js' }),
  },
]);
