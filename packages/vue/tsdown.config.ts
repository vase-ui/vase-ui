import { defineConfig } from 'tsdown';
import { buildOptions, familyEntries, writeBarrel } from './scripts/build.ts';

writeBarrel('src/index.ts', ['src']);

export default defineConfig(
  buildOptions({ index: 'src/index.ts', ...familyEntries('src') }, 'dist'),
);
