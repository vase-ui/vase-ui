import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  probeFrameAfterExit,
  screen,
  waitFor,
} from '#test-utils';
import MotionVDialog from './MotionVDialog.test.vue';
import MotionVPanel from './MotionVPanel.test.vue';

// `probeFrameAfterExit` needs an exit of 100 s.
const LONG_EXIT = 100;

describe('a popup with a motion-v component', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
  });

  afterEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

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

  // A probe that cannot see a late removal proves nothing.
  it('finds a motion-v panel in the frame when its removal comes in a later task', async () => {
    const open = shallowRef(true);
    const onOpenChangeComplete = vi.fn();
    await render(() => (
      <MotionVPanel
        open={open.value}
        duration={LONG_EXIT}
        onOpenChangeComplete={onOpenChangeComplete}
      />
    ));
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });
    const panel = screen.getByTestId('panel');

    const result = await probeFrameAfterExit(
      panel,
      () => !panel.isConnected,
      () => {
        open.value = false;
      },
    );

    expect(result).toEqual({ isGone: false, isSameFrame: true });
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });
    expect(panel.isConnected).toBe(false);
  });
});
