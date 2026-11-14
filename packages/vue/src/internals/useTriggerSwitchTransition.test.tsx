import { describe, expect, it } from 'vitest';
import { defineComponent, shallowReactive, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, waitFor, waitSingleFrame } from '#test-utils';
import { useTriggerSwitchTransition } from './useTriggerSwitchTransition';

type InstantType = string | undefined;

const KEYFRAMES = '@keyframes trigger-switch { from { opacity: 1; } to { opacity: 0.5; } }';

/**
 * A part that calls the composable with a store that records each write of `instantType`. The
 * positioner element has an animation of 100 s, which a case ends with `finish()`.
 */
function createHarness(options: { instantType?: InstantType; firstTrigger?: boolean } = {}) {
  const [first, second] = [document.createElement('button'), document.createElement('button')];
  const trigger = shallowRef<Element | null>(options.firstTrigger === false ? null : first);
  const positioner = shallowRef<HTMLElement | null>(null);
  // The store and the `open` parameter are two refs, so that a case can close the store first.
  const storeOpen = shallowRef(true);
  const open = shallowRef(true);
  const state = shallowReactive<{ instantType: InstantType }>({ instantType: options.instantType });
  const writes: InstantType[] = [];

  const store = {
    state,
    set(_key: 'instantType', value: 'trigger-change' | undefined) {
      state.instantType = value;
      writes.push(value);
    },
    select: (_key: 'open') => storeOpen.value,
  };

  const Part = defineComponent({
    setup() {
      useTriggerSwitchTransition({
        store,
        domReference: trigger,
        positionerElement: positioner,
        open,
      });
      return () => (
        <>
          <style>{KEYFRAMES}</style>
          <div ref={positioner} style={{ animation: 'trigger-switch 100s linear' }} />
        </>
      );
    },
  });

  function setOpen(value: boolean) {
    storeOpen.value = value;
    open.value = value;
  }

  /**
   * Moves to another trigger and waits until the composable waits for the animations: it reads
   * them in the next frame.
   */
  async function move(next: Element | null) {
    trigger.value = next;
    await flushMicrotasks();
    await waitSingleFrame();
    await flushMicrotasks();
  }

  function finishAnimations() {
    const animations = positioner.value!.getAnimations();
    expect(animations).toHaveLength(1);
    animations[0]!.finish();
  }

  return {
    Part,
    trigger,
    first,
    second,
    storeOpen,
    state,
    writes,
    setOpen,
    move,
    finishAnimations,
  };
}

describe('useTriggerSwitchTransition', () => {
  const { render } = createRenderer();

  it('clears `instantType` for a move to another trigger and sets `trigger-change` when the animations end', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const harness = createHarness({ instantType: 'click' });
    await render(<harness.Part />);

    await harness.move(harness.second);
    expect(harness.writes).toEqual([undefined]);

    harness.finishAnimations();
    await waitFor(() => {
      expect(harness.state.instantType).toBe('trigger-change');
    });
    expect(harness.writes).toEqual([undefined, 'trigger-change']);
  });

  it('does not move for the first trigger', async () => {
    const harness = createHarness({ instantType: 'click', firstTrigger: false });
    await render(<harness.Part />);

    harness.trigger.value = harness.first;
    await flushMicrotasks();

    expect(harness.writes).toEqual([]);
    expect(harness.state.instantType).toBe('click');
  });

  it('moves from the last trigger when the trigger is `null` in between', async () => {
    const harness = createHarness({ instantType: 'click' });
    await render(<harness.Part />);
    harness.trigger.value = null;
    await flushMicrotasks();
    expect(harness.writes).toEqual([]);

    harness.trigger.value = harness.second;
    await flushMicrotasks();

    expect(harness.writes).toEqual([undefined, 'trigger-change']);
  });

  it('does not move while the popup is closed', async () => {
    const harness = createHarness({ instantType: 'click' });
    await render(<harness.Part />);
    harness.setOpen(false);
    await flushMicrotasks();

    harness.trigger.value = harness.second;
    await flushMicrotasks();

    expect(harness.writes).toEqual([]);
    expect(harness.state.instantType).toBe('click');
  });

  it.each<{ name: string; instantType: InstantType; expected: InstantType; writes: InstantType[] }>(
    [
      {
        name: 'clears `trigger-change`',
        instantType: 'trigger-change',
        expected: undefined,
        writes: [undefined],
      },
      { name: 'keeps `click`', instantType: 'click', expected: 'click', writes: [] },
    ],
  )('$name when the popup closes', async ({ instantType, expected, writes }) => {
    const harness = createHarness({ instantType });
    await render(<harness.Part />);

    harness.setOpen(false);
    await flushMicrotasks();

    expect(harness.state.instantType).toBe(expected);
    expect(harness.writes).toEqual(writes);
  });

  it('does not set `trigger-change` when the popup closes and opens again while a move waits for the animations', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const harness = createHarness({ instantType: 'click' });
    await render(<harness.Part />);
    await harness.move(harness.second);

    harness.setOpen(false);
    await flushMicrotasks();
    harness.setOpen(true);
    await flushMicrotasks();
    harness.finishAnimations();
    await flushMicrotasks();

    expect(harness.writes).toEqual([undefined]);
    expect(harness.state.instantType).toBe(undefined);
  });

  it('does not set `trigger-change` when the store is closed as the animations end', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const harness = createHarness({ instantType: 'click' });
    await render(<harness.Part />);
    await harness.move(harness.second);

    // The `open` parameter still has `true`: the update that closes the popup has not run yet.
    harness.storeOpen.value = false;
    harness.finishAnimations();
    await flushMicrotasks();

    expect(harness.writes).toEqual([undefined]);
  });

  it('does not set `trigger-change` after the part unmounts while a move waits for the animations', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const harness = createHarness({ instantType: 'click' });
    const { unmount } = await render(<harness.Part />);
    await harness.move(harness.second);

    unmount();
    // The browser cancels the animations of the removed element in the next frames.
    await waitSingleFrame();
    await waitSingleFrame();
    await flushMicrotasks();

    expect(harness.writes).toEqual([undefined]);
  });
});
