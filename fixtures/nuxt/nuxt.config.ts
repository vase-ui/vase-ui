import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-11-12',
  devtools: { enabled: false },
  telemetry: false,
  // With this key, Vue reports a class, style or attribute mismatch of a hydration in a production
  // build also.
  debug: { hydration: true },
});
