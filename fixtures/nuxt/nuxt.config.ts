import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-11-12',
  devtools: { enabled: false },
  telemetry: false,
  // With this key, Vue reports a class, style or attribute mismatch of a hydration in a production
  // build also.
  debug: { hydration: true },
  typescript: {
    tsConfig: {
      compilerOptions: {
        // A page imports a part by its path while no entry point exports it, so the type check reads
        // the source of the package. The source does not follow these two options of Nuxt.
        noUncheckedIndexedAccess: false,
        noImplicitOverride: false,
      },
    },
  },
});
