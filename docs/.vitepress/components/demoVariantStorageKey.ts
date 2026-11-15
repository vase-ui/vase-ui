/**
 * The key of `localStorage` that keeps the variant of the demos. A script in the head of each page
 * reads it. The key has a module of its own, because `config.ts` reads it in Node, and `demoVariant.ts`
 * needs the types of the DOM.
 */
export const DEMO_VARIANT_STORAGE_KEY = 'vase-ui-demo-variant';
