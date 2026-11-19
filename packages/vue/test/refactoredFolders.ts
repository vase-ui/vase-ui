/**
 * The folders of `src` whose families follow the forms of `test/render.ts`: one native element for
 * each part, the `element` slot, and `<Transition>` in place of the transition status. Their tests
 * also run with Vue 3.6 in the setups of `vitest.vue-3.6.config.ts`, and some lint rules for the
 * older forms leave them out.
 */
export const REFACTORED_FOLDERS = [
  'avatar',
  'checkbox',
  'checkbox-group',
  'field',
  'fieldset',
  'form',
  'input',
  'progress',
  'radio',
  'radio-group',
  'separator',
  'switch',
];
