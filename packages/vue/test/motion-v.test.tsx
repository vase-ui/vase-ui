import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import MotionVDialog from './MotionVDialog.test.vue';

describe('a popup with a motion-v component', () => {
  const { render } = createRenderer();

  it('keeps the popup of a dialog while motion-v animates its leave in the JavaScript hooks of <Transition>, and removes it at the end', async () => {
    const open = shallowRef(true);
    const afterLeave = vi.fn();
    const { user } = await render(() => (
      <MotionVDialog
        open={open.value}
        duration={0.2}
        onUpdate:open={(nextOpen: boolean) => {
          open.value = nextOpen;
        }}
        onAfterLeave={afterLeave}
      />
    ));
    const popup = await screen.findByTestId('popup');
    await user.keyboard('{Escape}');
    await flushMicrotasks();
    expect(popup.isConnected).toBe(true);
    expect(afterLeave).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(afterLeave).toHaveBeenCalledTimes(1);
    });
    expect(popup.isConnected).toBe(false);
  });
});
