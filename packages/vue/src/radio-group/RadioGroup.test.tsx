import { describe, expect, it } from 'vitest';
import { hydrate, renderOnServer } from '#test-utils';
import RadioGroupHydration from './RadioGroupHydration.test.vue';

const HYDRATION_FIXTURE = 'src/radio-group/RadioGroupHydration.test.vue';

function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map(
    (testId) => root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex') ?? null,
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
  });
});
