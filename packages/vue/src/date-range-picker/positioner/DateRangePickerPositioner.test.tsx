import { describe, expect, it, onTestFinished } from 'vitest';
import { isRef, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import {
  createRenderer,
  flushMicrotasks,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';

const range = [
  Temporal.PlainDate.from('2026-11-18'),
  Temporal.PlainDate.from('2026-11-20'),
] as const;

describe('<DateRangePicker.Positioner />', () => {
  const { render } = createRenderer();

  type Fields = 'both' | 'start' | 'none';

  // The end field is taller than the start field, so the box around them ends at the end field.
  // `fields` can be a ref, so that a case changes the fields after the render.
  function renderPicker(
    options: {
      fields?: Fields | ShallowRef<Fields>;
      anchor?: HTMLElement | undefined;
      align?: 'start' | 'center' | 'end';
    } = {},
  ) {
    const { fields: fieldsOption = 'both', anchor, align } = options;
    return render(() => {
      const fields = isRef(fieldsOption) ? fieldsOption.value : fieldsOption;
      return (
        <div style={{ padding: '100px' }}>
          <DateRangePicker.Root open defaultValue={range} locale="en-US">
            {fields === 'none' ? null : (
              <DateRangePicker.StartField
                data-testid="start-field"
                style={{
                  display: 'inline-block',
                  verticalAlign: 'top',
                  width: '150px',
                  height: '30px',
                }}
              >
                <DateField.Input />
              </DateRangePicker.StartField>
            )}
            {fields === 'both' ? (
              <DateRangePicker.EndField
                data-testid="end-field"
                style={{
                  display: 'inline-block',
                  verticalAlign: 'top',
                  width: '150px',
                  height: '60px',
                  marginLeft: '40px',
                }}
              >
                <DateField.Input />
              </DateRangePicker.EndField>
            ) : null}
            <DateRangePicker.Trigger
              data-testid="trigger"
              style={{ marginLeft: '100px', width: '40px' }}
            >
              Open
            </DateRangePicker.Trigger>
            <DateRangePicker.Portal>
              <DateRangePicker.Positioner
                data-testid="positioner"
                anchor={anchor}
                align={align}
                sideOffset={0}
              >
                <DateRangePicker.Popup
                  aria-label="Choose dates"
                  style={{ width: '100px', height: '50px' }}
                >
                  Content
                </DateRangePicker.Popup>
              </DateRangePicker.Positioner>
            </DateRangePicker.Portal>
          </DateRangePicker.Root>
        </div>
      );
    });
  }

  async function findPositioner() {
    const positioner = await screen.findByTestId('positioner');
    await waitForPositioned(positioner);
    return positioner;
  }

  it('positions the popup against the box around the two fields, and aligns it with their start', async () => {
    await renderPicker();
    const positioner = await findPositioner();

    const start = screen.getByTestId('start-field').getBoundingClientRect();
    const end = screen.getByTestId('end-field').getBoundingClientRect();
    const popup = positioner.getBoundingClientRect();
    expect(popup.left).toBeCloseTo(start.left, 0);
    expect(popup.top).toBeCloseTo(Math.max(start.bottom, end.bottom), 0);
    expect(positioner).toHaveAttribute('data-align', 'start');
    expect(positioner).toHaveAttribute('data-side', 'bottom');
  });

  it('aligns the end of the popup with the end of the two fields for `align="end"`', async () => {
    await renderPicker({ align: 'end' });
    const positioner = await findPositioner();

    const end = screen.getByTestId('end-field').getBoundingClientRect();
    expect(positioner.getBoundingClientRect().right).toBeCloseTo(end.right, 0);
  });

  it('positions the popup against the start field when the picker has no other field', async () => {
    await renderPicker({ fields: 'start' });
    const positioner = await findPositioner();

    const start = screen.getByTestId('start-field').getBoundingClientRect();
    expect(positioner.getBoundingClientRect().left).toBeCloseTo(start.left, 0);
    expect(positioner.getBoundingClientRect().top).toBeCloseTo(start.bottom, 0);
  });

  it.each([
    { name: 'the end field', from: 'both' as const, to: 'start' as const, side: 'start-field' },
    { name: 'both fields', from: 'both' as const, to: 'none' as const, side: 'trigger' },
  ])(
    'positions the popup without the box of $name after it unmounts',
    async ({ from, to, side }) => {
      const fields = shallowRef<Fields>(from);
      await renderPicker({ fields });
      await findPositioner();

      fields.value = to;
      await flushMicrotasks();
      const positioner = await findPositioner();

      const anchor = screen.getByTestId(side).getBoundingClientRect();
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().top).toBeCloseTo(anchor.bottom, 0);
      });
      expect(positioner.getBoundingClientRect().left).toBeCloseTo(anchor.left, 0);
    },
  );

  it('positions the popup against the trigger when the picker has no field', async () => {
    await renderPicker({ fields: 'none' });
    const positioner = await findPositioner();

    const trigger = screen.getByTestId('trigger').getBoundingClientRect();
    expect(positioner.getBoundingClientRect().left).toBeCloseTo(trigger.left, 0);
    expect(positioner.getBoundingClientRect().top).toBeCloseTo(trigger.bottom, 0);
  });

  it('takes the anchor that the consumer gives, in place of the fields', async () => {
    const anchor = document.createElement('div');
    onTestFinished(() => {
      anchor.remove();
    });
    anchor.style.cssText = 'position: absolute; left: 150px; top: 250px; width: 10px; height: 10px';
    document.body.append(anchor);

    await renderPicker({ anchor });
    const positioner = await findPositioner();

    expect(positioner.getBoundingClientRect().left).toBeCloseTo(
      anchor.getBoundingClientRect().left,
      0,
    );
    expect(positioner.getBoundingClientRect().top).toBeCloseTo(
      anchor.getBoundingClientRect().bottom,
      0,
    );
  });
});
