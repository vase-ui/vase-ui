import { defineConfig } from 'tsdown';
import {
  NUXT_MODULE_ENTRY,
  buildOptions,
  familyEntries,
  writeBarrel,
  writeModuleManifest,
} from './scripts/build.ts';

writeBarrel('src/index.ts', ['src']);

export default defineConfig({
  ...buildOptions({ index: 'src/index.ts', ...NUXT_MODULE_ENTRY, ...familyEntries('src') }, 'dist'),
  onSuccess: () => writeModuleManifest('dist'),
});
