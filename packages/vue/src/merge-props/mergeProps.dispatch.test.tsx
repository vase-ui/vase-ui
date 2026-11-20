import { describe, expect, it, vi } from 'vitest';
import { Combobox } from '@vase-ui/vue/combobox';
import { Dialog } from '@vase-ui/vue/dialog';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { createRenderer, screen, waitFor, waitForLaterMillisecond } from '#test-utils';

describe('VUE-82: preventVaseUIHandler() in a part inside another part', () => {
  const { render } = createRenderer();

  it('closes a tooltip around a dialog trigger whose click listener calls it', async () => {
    const onTooltipOpenChange = vi.fn();
    const onDialogOpenChange = vi.fn();
    const { user } = await render(
      <Tooltip.Root onOpenChange={onTooltipOpenChange}>
        <Tooltip.Trigger as="span" delay={0}>
          <Dialog.Root onOpenChange={onDialogOpenChange}>
            <Dialog.Trigger onClick={(event) => event.preventVaseUIHandler()}>Open</Dialog.Trigger>
          </Dialog.Root>
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

    expect(onDialogOpenChange).not.toHaveBeenCalled();
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
});
