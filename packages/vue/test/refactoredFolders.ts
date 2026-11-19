import { existsSync, readdirSync } from 'node:fs';

const SOURCE = new URL('../src/', import.meta.url);

/**
 * The folders of `src` whose families follow the forms of `test/render.ts`: one native element for
 * each part, the `element` slot, and `<Transition>` in place of the transition status. Their tests
 * also run with Vue 3.6 in the setups of `vitest.vue-3.6.config.ts`, and some lint rules for the
 * older forms leave them out. Such a folder is an entry point with a `types.ts`, and no family of
 * the older forms has a `types.ts`.
 */
export const REFACTORED_FOLDERS = readdirSync(SOURCE).filter((folder) =>
  ['index.ts', 'types.ts'].every((file) => existsSync(new URL(`${folder}/${file}`, SOURCE))),
);
