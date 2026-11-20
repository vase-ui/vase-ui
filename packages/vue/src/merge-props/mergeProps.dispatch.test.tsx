import { describe, expect, it, vi } from 'vitest';
import { NumberField } from '@vase-ui/vue/number-field';
import { Popover } from '@vase-ui/vue/popover';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { createRenderer, screen, waitFor, waitForLaterMillisecond } from '#test-utils';

describe('VUE-82: preventVaseUIHandler() in a part inside another part', () => {
  const { render } = createRenderer();

  it('closes a tooltip around a popover trigger whose click listener calls it', async () => {
    const onTooltipOpenChange = vi.fn();
    const onPopoverOpenChange = vi.fn();
    const { user } = await render(
      <Tooltip.Root onOpenChange={onTooltipOpenChange}>
        <Tooltip.Trigger as="span" delay={0}>
          <Popover.Root onOpenChange={onPopoverOpenChange}>
            <Popover.Trigger onClick={(event) => event.preventVaseUIHandler()}>
              Open
            </Popover.Trigger>
          </Popover.Root>
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

    expect(onPopoverOpenChange).not.toHaveBeenCalled();
    expect(onTooltipOpenChange.mock.calls.map((call) => [call[0], call[1].reason])).toEqual([
      [true, 'trigger-focus'],
      [false, 'trigger-press'],
    ]);
  });

  it('opens a tooltip around a number field input whose focusin listener calls it', async () => {
    const onTooltipOpenChange = vi.fn();
    const { user } = await render(
      <Tooltip.Root onOpenChange={onTooltipOpenChange}>
        <Tooltip.Trigger as="div" delay={0}>
          <NumberField.Root defaultValue={1}>
            <NumberField.Input
              aria-label="Amount"
              onFocusin={(event) => event.preventVaseUIHandler()}
            />
          </NumberField.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    await user.keyboard('[Tab]');
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();

    await waitFor(() => {
      expect(onTooltipOpenChange.mock.calls.map((call) => call[0])).toEqual([true]);
    });
  });
});
