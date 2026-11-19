// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import MeasureBlurOrder from '../fixtures/MeasureBlurOrder.vue';
import MeasureRegisterList from '../fixtures/MeasureRegisterList.vue';
import MeasureSwap from '../fixtures/MeasureSwap.vue';
import { mount, settle } from '../render';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('a v-if that replaces one component with another', () => {
  test.each([false, true])(
    'the old one leaves before the new one registers (in Transition: %s)',
    async (transition) => {
      const scene = reactive({ first: true });
      const log: string[] = [];
      mount(MeasureSwap, { scene, log, transition });
      await nextTick();
      scene.first = false;
      await settle();
      await wait(100);
      expect(log).toEqual(['add first', 'remove first', 'add second']);
    },
  );
});

describe('a keyed list', () => {
  test('registers an item that it puts first after the items that it had', async () => {
    const names = reactive(['b', 'c']);
    const log: string[] = [];
    const root = mount(MeasureRegisterList, { names, log }).root;
    await nextTick();
    names.unshift('a');
    await nextTick();
    expect(log).toEqual(['add b', 'add c', 'add a']);
    expect([...root.querySelectorAll('input')].map((input) => input.ariaLabel)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('two blur listeners', () => {
  test('the value that the later listener writes reaches the element after a timer; nextTick and a watcher see the old one', async () => {
    const model = reactive({ value: ' a ' });
    const log: string[] = [];
    const input = mount(MeasureBlurOrder, { model, log }).root.querySelector('input')!;
    // No render waits, as when a user leaves a field.
    await settle();
    input.focus();
    input.blur();
    await wait(0);
    await settle();
    expect(log).toEqual(['nextTick  a ', 'watcher  a ', 'timer a']);
  });
});
