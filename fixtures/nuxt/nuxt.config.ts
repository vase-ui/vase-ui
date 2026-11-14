import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-11-12',
  devtools: { enabled: false },
  telemetry: false,
  // With this key, Vue reports a class, style or attribute mismatch of a hydration in a production
  // build also.
  debug: { hydration: true },
  // A page imports a part by its source path while no entry point exports the part. The type check
  // of the fixture then reads the source of the package, which the package checks without these
  // two options. Nuxt sets both by default.
  typescript: {
    tsConfig: { compilerOptions: { noUncheckedIndexedAccess: false, noImplicitOverride: false } },
  },
});
