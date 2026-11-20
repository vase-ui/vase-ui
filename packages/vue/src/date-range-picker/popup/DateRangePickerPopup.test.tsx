import { describe, expect, it } from 'vitest';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { createRenderer, screen } from '#test-utils';

type Scope = { props: Record<string, unknown>; elementRef: (target: unknown) => void };

describe('<DateRangePicker.Popup />', () => {
  const { render } = createRenderer();

  it('gives the element slot of the trigger, the positioner and the popup to the parts of Popover', async () => {
    await render(
      <DateRangePicker.Root defaultOpen>
        <DateRangePicker.Trigger>
          {{ element: ({ props, elementRef }: Scope) => <a {...props} ref={elementRef} /> }}
        </DateRangePicker.Trigger>
        <DateRangePicker.Portal>
          <DateRangePicker.Positioner>
            {{
              element: ({ props, elementRef }: Scope) => (
                <section {...props} ref={elementRef} data-testid="positioner">
                  <DateRangePicker.Popup aria-label="Choose">
                    {{ element: ({ props, elementRef }: Scope) => <article {...props} ref={elementRef} /> }}
                  </DateRangePicker.Popup>
                </section>
              ),
            }}
          </DateRangePicker.Positioner>
        </DateRangePicker.Portal>
      </DateRangePicker.Root>,
    );

    expect(screen.getByRole('button').localName).toBe('a');
    expect((await screen.findByRole('dialog', { name: 'Choose' })).localName).toBe('article');
    expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'bottom');
  });
});
