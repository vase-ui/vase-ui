import { describe, expect, it } from 'vitest';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { createRenderer, screen } from '#test-utils';

type Scope = { props: Record<string, unknown>; elementRef: (target: unknown) => void };

describe('<DatePicker.Popup />', () => {
  const { render } = createRenderer();

  it('gives the element slot of the trigger, the positioner and the popup to the parts of Popover', async () => {
    await render(
      <DatePicker.Root defaultOpen>
        <DatePicker.Trigger>
          {{ element: ({ props, elementRef }: Scope) => <a {...props} ref={elementRef} /> }}
        </DatePicker.Trigger>
        <DatePicker.Portal>
          <DatePicker.Positioner>
            {{
              element: ({ props, elementRef }: Scope) => (
                <section {...props} ref={elementRef} data-testid="positioner">
                  <DatePicker.Popup aria-label="Choose">
                    {{
                      element: ({ props, elementRef }: Scope) => (
                        <article {...props} ref={elementRef} />
                      ),
                    }}
                  </DatePicker.Popup>
                </section>
              ),
            }}
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>,
    );

    expect(screen.getByRole('button').localName).toBe('a');
    expect((await screen.findByRole('dialog', { name: 'Choose' })).localName).toBe('article');
    expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'bottom');
  });
});
