import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  createRenderer,
  flushMicrotasks,
  screen,
  waitForLaterMillisecond,
  waitForPositioned,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as ContextMenu from '../index.parts';

vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, mac: true, apple: true },
    },
  };
});

describe('<ContextMenu.Root />', () => {
  const { render } = createRenderer();

  it.each([
    { name: '3px right', dx: 3, dy: 0, clicks: 0 },
    { name: '8px right and 8px down', dx: 8, dy: 8, clicks: 0 },
    { name: '9px right', dx: 9, dy: 0, clicks: 1 },
  ])('VUE-84: a right press that moves $name onto the first item', async ({ dx, dy, clicks }) => {
    // The popup has the border and the padding of the demo. With the default offsets of the
    // positioner, the top-left corner of the first item is then 3 px right of the open point.
    const onOpenChange = vi.fn();
    const onClick = vi.fn();
    await render(
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger style={{ width: '200px', height: '120px' }}>
          Surface
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner data-testid="positioner">
            <ContextMenu.Popup style={{ border: '1px solid', paddingBlock: '4px' }}>
              <ContextMenu.Item onClick={onClick} style={{ height: '32px' }}>
                One
              </ContextMenu.Item>
              <ContextMenu.Item style={{ height: '32px' }}>Two</ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );
    const surface = screen.getByText('Surface').getBoundingClientRect();
    const point = { x: Math.round(surface.left + 40), y: Math.round(surface.top + 30) };
    const target = { x: point.x + dx, y: point.y + dy };
    let held = true;
    onTestFinished(async () => {
      if (held) {
        await userEvent.pointer({ coords: target, keys: '[/MouseRight]' });
      }
    });

    const [first] = await waitForLaterMillisecond(async () => {
      await userEvent.pointer({ coords: point, keys: '[MouseRight>]' });
      return screen.findAllByRole('menuitem');
    });
    await waitForPositioned(screen.getByTestId('positioner'));
    // The menu opens at the press, before the release.
    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
    expect(first!.contains(document.elementFromPoint(target.x, target.y))).toBe(true);

    await userEvent.pointer({ coords: target });
    await userEvent.pointer({ coords: target, keys: '[/MouseRight]' });
    held = false;
    await flushMicrotasks();

    expect(onClick).toHaveBeenCalledTimes(clicks);
    if (clicks === 0) {
      expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
    } else {
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
    }
  });
});
