import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, finishAnimations, flushMicrotasks, screen, waitFor } from '#test-utils';
import MotionVDialog from './MotionVDialog.test.vue';

describe('a popup with a motion-v component', () => {
  const { render } = createRenderer();

  it('runs the enter of a dialog once with no `appear`, keeps the popup while motion-v animates its leave in the JavaScript hooks of <Transition>, and removes it at the end', async () => {
    const open = shallowRef(true);
    const enter = vi.fn();
    const afterEnter = vi.fn();
    const afterLeave = vi.fn();
    // Each animation lasts until the case ends it, so a stall of the page cannot end the leave
    // before the checks.
    const { user } = await render(() => (
      <MotionVDialog
        open={open.value}
        duration={100}
        onUpdate:open={(nextOpen: boolean) => {
          open.value = nextOpen;
        }}
        onEnter={enter}
        onAfterEnter={afterEnter}
        onAfterLeave={afterLeave}
      />
    ));
    const popup = await screen.findByTestId('popup');
    await finishAnimations(popup);
    await waitFor(() => {
      expect(afterEnter).toHaveBeenCalledTimes(1);
    });
    expect(enter).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    await flushMicrotasks();
    expect(popup.isConnected).toBe(true);
    expect(afterLeave).not.toHaveBeenCalled();
    await finishAnimations(popup);
    await waitFor(() => {
      expect(afterLeave).toHaveBeenCalledTimes(1);
    });
    expect(popup.isConnected).toBe(false);
  });
});
