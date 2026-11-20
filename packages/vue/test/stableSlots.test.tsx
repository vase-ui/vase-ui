import { describe, expect, it, vi } from 'vitest';
import { createRenderer, flushMicrotasks, screen, waitFor, waitForPositioned } from '#test-utils';
import DatePickerPositionerSlots from '../src/date-picker/positioner/DatePickerPositionerSlots.test.vue';
import DateRangePickerPositionerSlots from '../src/date-range-picker/positioner/DateRangePickerPositionerSlots.test.vue';
import TimePickerPositionerSlots from '../src/time-picker/positioner/TimePickerPositionerSlots.test.vue';
import ContextMenuPositionerSlots from './ContextMenuPositionerSlots.test.vue';

const partsWithPopup = [
  {
    name: 'ContextMenu.Positioner',
    Fixture: ContextMenuPositionerSlots,
    waitForPart: async () => waitForPositioned(await screen.findByTestId('positioner')),
  },
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

  async function renderPartAgain(part: (typeof partsWithPopup)[number], hasRenderSlot: boolean) {
    const onPartRender = vi.fn();
    const onInnerRender = vi.fn();
    const { Fixture } = part;
    const { setProps } = await render(
      <Fixture
        hasRenderSlot={hasRenderSlot}
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
    '$name does not render the content of the #render slot again when the part renders',
    async (part) => {
      expect(await renderPartAgain(part, true)).not.toHaveBeenCalled();
    },
  );
});
