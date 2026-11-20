import { describe, expect, it, vi } from 'vitest';
import { Menu } from '@vase-ui/vue/menu';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { createRenderer, screen, waitFor, waitForLaterMillisecond } from '#test-utils';

describe('VUE-82: preventVaseUIHandler() in a part inside another part', () => {
  const { render } = createRenderer();

  it('closes a tooltip around a menu trigger whose click listener calls it', async () => {
    const onTooltipOpenChange = vi.fn();
    const onMenuOpenChange = vi.fn();
    const { user } = await render(
      <Tooltip.Root onOpenChange={onTooltipOpenChange}>
        <Tooltip.Trigger as="span" delay={0}>
          <Menu.Root onOpenChange={onMenuOpenChange}>
            <Menu.Trigger onClick={(event) => event.preventVaseUIHandler()}>Open</Menu.Trigger>
          </Menu.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    await waitForLaterMillisecond(async () => {
      await user.keyboard('[Tab]');
      await waitFor(() => {
        expect(onTooltipOpenChange).toHaveBeenCalledTimes(1);
      });
    });
    await user.keyboard('[Enter]');

    expect(onMenuOpenChange).not.toHaveBeenCalled();
    expect(onTooltipOpenChange.mock.calls.map((call) => [call[0], call[1].reason])).toEqual([
      [true, 'trigger-focus'],
      [false, 'trigger-press'],
    ]);
  });

});
