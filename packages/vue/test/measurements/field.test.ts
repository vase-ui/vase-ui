// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureBlurOrder from '../fixtures/MeasureBlurOrder.vue';
import MeasureFocusLoss from '../fixtures/MeasureFocusLoss.vue';
import MeasureRegisterList from '../fixtures/MeasureRegisterList.vue';
import MeasureSwap from '../fixtures/MeasureSwap.vue';
import { mount, settle } from '../render';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A Vapor app reads a root prop that is a function as a getter, so a fixture logs to an object.
const recorder = (log: string[]) => ({ add: (entry: string) => log.push(entry) });

describe('a v-if that replaces one component with another', () => {
  test.each([false, true])(
    'the old one leaves before the new one registers (in Transition: %s)',
    async (transition) => {
      const scene = reactive({ first: true });
      const log: string[] = [];
      mount(MeasureSwap, { scene, transition, log: recorder(log) });
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
    const root = mount(MeasureRegisterList, { names, log: recorder(log) }).root;
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
    const model = reactive({
      value: ' a ',
      write(value: string) {
        model.value = value;
      },
    });
    const log: string[] = [];
    const input = mount(MeasureBlurOrder, { model, log: recorder(log) }).root.querySelector(
      'input',
    )!;
    // No render waits, as when a user leaves a field.
    await settle();
    input.focus();
    input.blur();
    await wait(0);
    await settle();
    expect(log).toEqual(['nextTick  a ', 'watcher  a ', 'timer a']);
  });
});

/** Mounts a focused input of `MeasureFocusLoss`. */
function focusedInput(kind: string) {
  const scene = reactive({ shown: true, disabled: false, visible: true });
  const log: string[] = [];
  const { root } = mount(MeasureFocusLoss, { scene, kind, log: recorder(log) });
  root.querySelector('input')!.focus();
  return { scene, log, root };
}

async function nextFrame() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('a focused input that Vue removes', () => {
  // The removing steps of the HTML Standard move the focus with no event.
  test.each(['v-if', 'parent', 'transition'])(
    'Chromium sends blur and focusout while the input is in the document, and it is out one microtask later; Firefox and WebKit send none (%s)',
    async (kind) => {
      const { scene, log, root } = focusedInput(kind);
      scene.shown = false;
      // A leave in `<Transition>` with no CSS removes the input after two frames.
      for (let frame = 0; frame < 10 && root.querySelector('input'); frame++) await nextFrame();
      await settle();
      expect(root.querySelector('input')).toBeNull();
      expect(log).toEqual(
        server.browser === 'chromium' ? ['blur true false', 'focusout true false'] : [],
      );
    },
  );
});

describe('a focused input that stays in the document', () => {
  // The focus fixup of the HTML Standard moves the focus with no event, but each browser sends one.
  test.each([
    {
      kind: 'disabled',
      change: (scene: { disabled: boolean }) => (scene.disabled = true),
      left: (input: HTMLInputElement) => input.matches(':disabled'),
    },
    {
      kind: 'v-show',
      change: (scene: { visible: boolean }) => (scene.visible = false),
      left: (input: HTMLInputElement) => input.getClientRects().length === 0,
    },
  ])(
    'gets blur and focusout in each browser when it becomes $kind; the input is then :disabled or has no box',
    async ({ kind, change, left }) => {
      const { scene, log, root } = focusedInput(kind);
      change(scene as never);
      await nextTick();
      await nextFrame();
      await settle();
      expect(log).toEqual(['blur true true', 'focusout true true']);
      expect(left(root.querySelector('input')!)).toBe(true);
    },
  );
});
