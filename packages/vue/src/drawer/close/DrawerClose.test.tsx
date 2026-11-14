import { describe, expect, it, vi } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as Drawer from '../index.parts';

describe('<Drawer.Close />', () => {
  const { render } = createRenderer();

  it('closes the drawer with the reason close-press', async () => {
    const handleOpenChange = vi.fn();
    const { user } = await render(
      <Drawer.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Close>Close</Drawer.Close>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBe(null);
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    const [open, details] = handleOpenChange.mock.calls[0];
    expect(open).toBe(false);
    expect(details.reason).toBe(REASONS.closePress);
  });
});
