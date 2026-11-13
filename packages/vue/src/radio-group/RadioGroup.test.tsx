import { describe, expect, it } from 'vitest';
import { hydrate, renderOnServer } from '#test-utils';
import RadioGroupFieldHydration from './RadioGroupFieldHydration.test.vue';
import RadioGroupHydration from './RadioGroupHydration.test.vue';

const HYDRATION_FIXTURE = 'src/radio-group/RadioGroupHydration.test.vue';
const FIELD_HYDRATION_FIXTURE = 'src/radio-group/RadioGroupFieldHydration.test.vue';

function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map(
    (testId) => root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex') ?? null,
  );
}

function readFilled(root: ParentNode) {
  return ['label', 'description'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.hasAttribute('data-filled'),
  );
}

// A `<template>` element parses the HTML with no side effect.
function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

describe('<RadioGroup />', () => {
  describe('VUE-2: hydration', () => {
    it('hydrates a group with a value on the second radio with no mismatch and keeps the tab stop', async () => {
      const props = { defaultValue: 'b' };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      expect(readTabindexes(parse(serverHtml))).toEqual(['-1', '0', '-1']);

      const { container } = await hydrate(RadioGroupHydration, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);
    });

    it.each([
      { name: 'that a radio has', defaultValue: 'b' },
      { name: 'that no radio has', defaultValue: 'z' },
    ])(
      'hydrates a group with a value $name in a field with no mismatch and fills the label and the description after it',
      async ({ defaultValue }) => {
        const props = { defaultValue };
        const serverHtml = await renderOnServer(FIELD_HYDRATION_FIXTURE, props);

        expect(readFilled(parse(serverHtml))).toEqual([true, true]);

        await hydrate(RadioGroupFieldHydration, { serverHtml, props });
      },
    );
  });
});
