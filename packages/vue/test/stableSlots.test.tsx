import { describe, expect, it, vi } from 'vitest';
import { createRenderer, flushMicrotasks, screen, waitFor, waitForPositioned } from '#test-utils';
import DatePickerPositionerSlots from './fixtures/DatePickerPositionerSlots.vue';
import DateRangePickerPositionerSlots from './fixtures/DateRangePickerPositionerSlots.vue';
import TimePickerPositionerSlots from './fixtures/TimePickerPositionerSlots.vue';

const partsWithPopup = [
  {
    name: 'DatePicker.Positioner',
    Fixture: DatePickerPositionerSlots,
    waitForPart: async () => waitForPositioned(await screen.findByTestId('positioner')),
  },
  {
    name: 'DateRangePicker.Positioner',
    Fixture: DateRangePickerPositionerSlots,
    waitForPart: async () => waitForPositioned(await screen.findByTestId('positioner')),
  },
  {
    name: 'TimePicker.Positioner',
    Fixture: TimePickerPositionerSlots,
    waitForPart: async () => waitForPositioned(await screen.findByTestId('positioner')),
  },
];

describe('a part that renders another part, with a popup below it', () => {
  const { render } = createRenderer();

  async function renderPartAgain(part: (typeof partsWithPopup)[number], hasElementSlot: boolean) {
    const onPartRender = vi.fn();
    const onInnerRender = vi.fn();
    const { Fixture } = part;
    const { setProps } = await render(
      <Fixture
        hasElementSlot={hasElementSlot}
        active={false}
        onPartRender={onPartRender}
        onInnerRender={onInnerRender}
      />,
    );
    await part.waitForPart();
    await flushMicrotasks();
    onPartRender.mockClear();
    onInnerRender.mockClear();

    await setProps({ active: true });
    await waitFor(() => expect(onPartRender).toHaveBeenCalled());
    await flushMicrotasks();

    return onInnerRender;
  }

  it.each(partsWithPopup)(
    '$name does not render the content again when the part renders',
    async (part) => {
      expect(await renderPartAgain(part, false)).not.toHaveBeenCalled();
    },
  );

  it.each(partsWithPopup)(
    '$name does not render the content of the element slot again when the part renders',
    async (part) => {
      expect(await renderPartAgain(part, true)).not.toHaveBeenCalled();
    },
  );
});
