import { describe, expect, it, onTestFinished } from 'vitest';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createRenderer, screen, waitForPositioned } from '#test-utils';

const time = Temporal.PlainTime.from('15:04');

describe('<TimePicker.Positioner />', () => {
  const { render } = createRenderer();

  function renderPicker(options: { field?: boolean; anchor?: HTMLElement | undefined } = {}) {
    const { field = true, anchor } = options;
    return render(
      <div style={{ padding: '100px' }}>
        <TimePicker.Root open defaultValue={time} locale="en-US">
          {field ? (
            <TimePicker.Field
              data-testid="field"
              style={{ display: 'inline-block', width: '200px' }}
            >
              <TimeField.Input />
            </TimePicker.Field>
          ) : null}
          <TimePicker.Trigger data-testid="trigger" style={{ marginLeft: '100px', width: '40px' }}>
            Open
          </TimePicker.Trigger>
          <TimePicker.Portal>
            <TimePicker.Positioner data-testid="positioner" anchor={anchor} sideOffset={0}>
              <TimePicker.Popup aria-label="Choose time" style={{ width: '100px', height: '50px' }}>
                Content
              </TimePicker.Popup>
            </TimePicker.Positioner>
          </TimePicker.Portal>
        </TimePicker.Root>
      </div>,
    );
  }

  it('positions the popup against the field, and aligns it with the start of the field', async () => {
    await renderPicker();
    const positioner = await screen.findByTestId('positioner');
    await waitForPositioned(positioner);

    const field = screen.getByTestId('field').getBoundingClientRect();
    const popup = positioner.getBoundingClientRect();
    expect(popup.left).toBeCloseTo(field.left, 0);
    expect(popup.top).toBeCloseTo(field.bottom, 0);
    expect(positioner).toHaveAttribute('data-align', 'start');
    expect(positioner).toHaveAttribute('data-side', 'bottom');
  });

  it('positions the popup against the trigger when the picker has no field', async () => {
    await renderPicker({ field: false });
    const positioner = await screen.findByTestId('positioner');
    await waitForPositioned(positioner);

    const trigger = screen.getByTestId('trigger').getBoundingClientRect();
    expect(positioner.getBoundingClientRect().left).toBeCloseTo(trigger.left, 0);
    expect(positioner.getBoundingClientRect().top).toBeCloseTo(trigger.bottom, 0);
  });

  it('takes the anchor that the consumer gives, in place of the field', async () => {
    const anchor = document.createElement('div');
    onTestFinished(() => {
      anchor.remove();
    });
    anchor.style.cssText = 'position: absolute; left: 150px; top: 250px; width: 10px; height: 10px';
    document.body.append(anchor);

    await renderPicker({ anchor });
    const positioner = await screen.findByTestId('positioner');
    await waitForPositioned(positioner);

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
