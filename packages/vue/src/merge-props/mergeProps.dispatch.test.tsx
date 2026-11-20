import { describe, expect, it, vi } from 'vitest';
import { Combobox } from '@vase-ui/vue/combobox';
import { Menu } from '@vase-ui/vue/menu';
import { Toolbar } from '@vase-ui/vue/toolbar';
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

  it('opens a tooltip around a combobox input whose focusin listener calls it', async () => {
    const onTooltipOpenChange = vi.fn();
    const { user } = await render(
      <Tooltip.Root onOpenChange={onTooltipOpenChange}>
        <Tooltip.Trigger as="div" delay={0}>
          <Combobox.Root>
            <Combobox.Input
              aria-label="Amount"
              onFocusin={(event) => event.preventVaseUIHandler()}
            />
          </Combobox.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    await user.keyboard('[Tab]');
    expect(screen.getByRole('combobox', { name: 'Amount' })).toHaveFocus();

    await waitFor(() => {
      expect(onTooltipOpenChange.mock.calls.map((call) => call[0])).toEqual([true]);
    });
  });

  it('moves the focus of a toolbar with a root listener after a call on a button', async () => {
    const { user } = await render(
      <Toolbar.Root onKeydown={() => {}}>
        <Toolbar.Button
          onKeydown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventVaseUIHandler();
            }
          }}
        >
          One
        </Toolbar.Button>
        <Toolbar.Button>Two</Toolbar.Button>
      </Toolbar.Root>,
    );

    await user.keyboard('[Tab]');
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus();
    await user.keyboard('[ArrowRight]');

    expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
  });
});
