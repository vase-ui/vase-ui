import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  waitForLaterMillisecond,
} from '#test-utils';
import * as ContextMenu from '../index.parts';

vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, mac: false, apple: false },
    },
  };
});

describe('<ContextMenu.Root /> (non-Mac)', () => {
  const { render } = createRenderer();

  describe('interactions', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ignores context menu mouseup on non-Mac platforms', async () => {
      const onOpenChange = vi.fn();

      await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="context-trigger">Surface</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner alignOffset={0}>
              <ContextMenu.Popup data-testid="context-popup">
                <ContextMenu.Item data-testid="context-item">Action</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('context-trigger');

      await waitForLaterMillisecond(async () => {
        await fireEvent.contextMenu(trigger, { clientX: 12, clientY: 12, button: 2 });

        await screen.findByTestId('context-popup');
      });
      const item = screen.getByTestId('context-item');

      await fireEvent.pointerMove(document.body, { clientX: 24, clientY: 24 });
      await fireEvent.mouseUp(item, { button: 2, clientX: 24, clientY: 24 });
      await flushMicrotasks();

      expect(screen.queryByTestId('context-popup')).not.toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(1);
    });
  });
});
