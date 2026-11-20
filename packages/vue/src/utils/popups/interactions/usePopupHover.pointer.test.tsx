import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { clientCenter, createRenderer, screen, waitFor, waitForPositioned } from '#test-utils';
import { REASONS } from '../../../internals/reasons';
import * as Menu from '../../../menu/index.parts';

// The cases move the real pointer. A pointer event of the test is trusted, and its `relatedTarget`
// is the element that the browser finds under the pointer.

const TRIGGER_STYLE = { position: 'absolute', top: '20px', width: '80px', height: '24px' } as const;

async function movePointerTo(element: Element) {
  const { clientX, clientY } = clientCenter(element);
  await userEvent.pointer({ coords: { x: clientX, y: clientY } });
}

describe('usePopupHover with a real pointer', () => {
  const { render } = createRenderer();

  it('VUE-94: moves a menu to the next hover trigger with no close', async () => {
    const onOpenChange = vi.fn();
    const handle = Menu.createHandle<number>();
    await render(
      <div style={{ position: 'relative', height: '200px' }}>
        <Menu.Trigger
          handle={handle}
          payload={1}
          openOnHover
          delay={0}
          style={{ ...TRIGGER_STYLE, left: '20px' }}
        >
          Trigger 1
        </Menu.Trigger>
        <Menu.Trigger
          handle={handle}
          payload={2}
          openOnHover
          delay={0}
          style={{ ...TRIGGER_STYLE, left: '100px' }}
        >
          Trigger 2
        </Menu.Trigger>
        <Menu.Root handle={handle} onOpenChange={onOpenChange}>
          {{
            default: ({ payload }: { payload: number | undefined }) => (
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner">
                  <Menu.Popup data-testid="popup">
                    <Menu.Item data-testid="content">{payload}</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            ),
          }}
        </Menu.Root>
      </div>,
    );
    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

    await userEvent.hover(screen.getByRole('button', { name: 'Trigger 1' }));
    await waitForPositioned(screen.getByTestId('positioner'));
    const popup = screen.getByTestId('popup');
    onOpenChange.mockClear();

    await movePointerTo(trigger2);
    await waitFor(() => {
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    expect(onOpenChange.mock.calls).toEqual([
      [true, expect.objectContaining({ reason: REASONS.triggerHover, trigger: trigger2 })],
    ]);
    expect(screen.getByTestId('popup')).toBe(popup);
  });
});
