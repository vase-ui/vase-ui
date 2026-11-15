/**
 * The key of `localStorage` that keeps the variant of the demos. A script in the head of each page
 * reads it. The key has a module of its own, because the root project checks `config.ts` with no
 * types of the DOM, and `demoVariant.ts` needs those types.
 */
export const DEMO_VARIANT_STORAGE_KEY = 'vase-ui-demo-variant';
