import { describe, expect, it, vi } from 'vitest';
import { createRenderer, flushMicrotasks, screen, waitFor, waitForPositioned } from '#test-utils';
import DateRangePickerPositionerSlots from './DateRangePickerPositionerSlots.test.vue';

// The positioner renders `Popover.Positioner` and has a popup below it. A `v-if` on a slot template
// would make the slots dynamic, and the popup would render again with the positioner.
describe('<DateRangePicker.Positioner /> slots', () => {
  const { render } = createRenderer();

  async function renderPartAgain(hasRenderSlot: boolean) {
    const onPartRender = vi.fn();
    const onInnerRender = vi.fn();
    const { setProps } = await render(
      <DateRangePickerPositionerSlots
        hasRenderSlot={hasRenderSlot}
        active={false}
        onPartRender={onPartRender}
        onInnerRender={onInnerRender}
      />,
    );
    await waitForPositioned(await screen.findByTestId('positioner'));
    await flushMicrotasks();
    onPartRender.mockClear();
    onInnerRender.mockClear();

    await setProps({ active: true });
    await waitFor(() => {
      expect(onPartRender).toHaveBeenCalled();
    });
    await flushMicrotasks();

    return onInnerRender;
  }

  it('does not render the content again when the part renders', async () => {
    expect(await renderPartAgain(false)).not.toHaveBeenCalled();
  });

  it('does not render the content of the #render slot again when the part renders', async () => {
    expect(await renderPartAgain(true)).not.toHaveBeenCalled();
  });
});
