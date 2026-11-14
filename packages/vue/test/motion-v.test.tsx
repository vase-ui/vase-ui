import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import type { VariantType } from 'motion-v';
import {
  createRenderer,
  flushMicrotasks,
  nextAnimationsRead,
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

  async function renderOpenDialog(options: {
    form?: 'render' | 'as';
    closed: VariantType;
    opened: VariantType;
    duration?: number;
    preventUnmountOnClose?: boolean;
    onExitComplete?: () => void;
  }) {
    const open = shallowRef(true);
    const dialog = shallowRef<{ unmount(): void } | null>(null);
    const onOpenChangeComplete = vi.fn();
    const { user } = await render(() => (
      <MotionVDialog
        ref={dialog}
        open={open.value}
        form={options.form ?? 'render'}
        closed={options.closed}
        opened={options.opened}
        duration={options.duration ?? LONG_EXIT}
        preventUnmountOnClose={options.preventUnmountOnClose}
        onUpdate:open={(nextOpen: boolean) => {
          open.value = nextOpen;
        }}
        onOpenChangeComplete={onOpenChangeComplete}
        onExitComplete={options.onExitComplete}
      />
    ));
    await flushMicrotasks();
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });
    return { open, dialog, onOpenChangeComplete, user, popup: screen.getByTestId('popup') };
  }

  it.each([
    { form: 'render', name: 'the #render slot' },
    { form: 'as', name: 'the as prop' },
  ] as const)(
    'removes a popup composed through $name in the frame in which its motion-v exit ends',
    async ({ form }) => {
      const { open, onOpenChangeComplete, popup } = await renderOpenDialog({
        form,
        closed: { opacity: 0 },
        opened: { opacity: 1 },
      });

      const result = await probeFrameAfterExit(
        popup,
        () => !popup.isConnected,
        () => {
          open.value = false;
        },
      );

      expect(result).toEqual({ isGone: true, isSameFrame: true });
      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
    },
  );

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

  it('finds no animation for a value that motion-v animates in JavaScript', async () => {
    const { open, onOpenChangeComplete, popup } = await renderOpenDialog({
      closed: { height: 0 },
      opened: { height: 100 },
    });

    const animations = await nextAnimationsRead(popup, {
      action: () => {
        open.value = false;
      },
    });

    expect(animations).toEqual([]);
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });
    expect(popup.isConnected).toBe(false);
  });

  it('keeps a popup that prevents its unmount until the unmount action', async () => {
    const connectedAtExitEnd: boolean[] = [];
    const { dialog, onOpenChangeComplete, user, popup } = await renderOpenDialog({
      closed: { height: 0 },
      opened: { height: 100 },
      duration: 0.2,
      preventUnmountOnClose: true,
      onExitComplete: () => {
        connectedAtExitEnd.push(popup.isConnected);
        dialog.value?.unmount();
      },
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });
    expect(connectedAtExitEnd).toEqual([true]);
    expect(popup.isConnected).toBe(false);
  });
});
