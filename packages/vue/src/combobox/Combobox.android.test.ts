import { expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import { mount } from '../../test/render';

vi.mock('../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../common/platform')>('../common/platform');
  return {
    ...actual,
    platform: { ...actual.platform, os: { ...actual.platform.os, android: true } },
  };
});

test('on Android, the input writes the text at each `input` of a composition, so the list filters', async () => {
  const texts: string[] = [];
  mount(ComboboxParts, { root: { 'onUpdate:inputValue': (text: string) => texts.push(text) } });
  await nextTick();
  const input = document.querySelector<HTMLInputElement>('[data-testid="input"]')!;
  input.focus();
  input.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
  input.value = 'ap';
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: 'ap' }));
  expect(texts).toEqual(['ap']);
});
