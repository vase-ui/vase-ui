import { describe, expect, it } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createRenderer, screen } from '#test-utils';

type Scope = { props: Record<string, unknown>; elementRef: (target: unknown) => void };

describe('<TimePicker.Popup />', () => {
  const { render } = createRenderer();

  it('gives the element slot of the trigger, the positioner and the popup to the parts of Popover', async () => {
    await render(
      <TimePicker.Root defaultOpen>
        <TimePicker.Trigger>
          {{ element: ({ props, elementRef }: Scope) => <a {...props} ref={elementRef} /> }}
        </TimePicker.Trigger>
        <TimePicker.Portal>
          <TimePicker.Positioner>
            {{
              element: ({ props, elementRef }: Scope) => (
                <section {...props} ref={elementRef} data-testid="positioner">
                  <TimePicker.Popup aria-label="Choose">
                    {{
                      element: ({ props, elementRef }: Scope) => (
                        <article {...props} ref={elementRef} />
                      ),
                    }}
                  </TimePicker.Popup>
                </section>
              ),
            }}
          </TimePicker.Positioner>
        </TimePicker.Portal>
      </TimePicker.Root>,
    );

    expect(screen.getByRole('button').localName).toBe('a');
    expect((await screen.findByRole('dialog', { name: 'Choose' })).localName).toBe('article');
    expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'bottom');
  });
});
