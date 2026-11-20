import { describe, expect, it, vi } from 'vitest';
import { mergeProps } from '@vase-ui/vue/merge-props';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { createRenderer, waitFor, waitForLaterMillisecond } from '#test-utils';

describe('VUE-82: preventVaseUIHandler() in a part inside another part', () => {
  const { render } = createRenderer();

  it('closes a tooltip around a button whose merged click listener calls it', async () => {
    const onTooltipOpenChange = vi.fn();
    const onInnerClick = vi.fn();
    const buttonProps = mergeProps<'button'>(
      { onClick: onInnerClick },
      { onClick: (event) => event.preventVaseUIHandler() },
    );
    const { user } = await render(
      <Tooltip.Root onOpenChange={onTooltipOpenChange}>
        <Tooltip.Trigger as="span" delay={0}>
          <button type="button" {...buttonProps}>
            Open
          </button>
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

    expect(onInnerClick).not.toHaveBeenCalled();
    expect(onTooltipOpenChange.mock.calls.map((call) => [call[0], call[1].reason])).toEqual([
      [true, 'trigger-focus'],
      [false, 'trigger-press'],
    ]);
  });
});
