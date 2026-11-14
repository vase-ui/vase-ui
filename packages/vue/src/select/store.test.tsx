import { expect, vi, describe, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { createRenderer, screen } from '#test-utils';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import * as Select from './index.parts';
import { useSelectRootContext } from './root/SelectRootContext';

describe('select store synchronization', () => {
  const { render } = createRenderer();

  it('provides setOpen to a descendant ref callback on the first commit', async () => {
    const handleOpenChange = vi.fn();
    let invoked = false;

    const CommandProbe = defineComponent({
      setup() {
        const store = useSelectRootContext();

        return () =>
          h('div', {
            ref: (element: unknown) => {
              if (element && !invoked) {
                invoked = true;
                store.setOpen(true, createChangeEventDetails(REASONS.none));
              }
            },
          });
      },
    });

    await render(
      <Select.Root onOpenChange={handleOpenChange}>
        <CommandProbe />
        <Select.Trigger />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="alpha">alpha</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    expect(invoked).toBe(true);
    expect(handleOpenChange).toHaveBeenCalled();
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
  });

  it('gives a new disabled prop of the root to the items in the render that changes it', async () => {
    const handleValueChange = vi.fn();
    let clickOnUpdate = false;
    let clicked = false;

    const Fixture = defineComponent({
      props: { disabled: { type: Boolean, required: true } },
      setup: (props) => () => (
        <Select.Root defaultOpen disabled={props.disabled} onValueChange={handleValueChange}>
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item
                  value="alpha"
                  v-slots={{
                    render: ({ props: itemProps }: { props: Record<string, any> }) =>
                      h(
                        'div',
                        {
                          ...itemProps,
                          'data-testid': 'item',
                          ref: (element: unknown) => {
                            itemProps.ref(element);
                            if (element && clickOnUpdate && !clicked) {
                              clicked = true;
                              (element as HTMLElement).click();
                            }
                          },
                        },
                        'alpha',
                      ),
                  }}
                />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ),
    });

    const { setProps } = await render(<Fixture disabled={false} />);
    const item = await screen.findByTestId('item');

    clickOnUpdate = true;
    await setProps({ disabled: true });

    // The root writes its props to the store before the items render, so a click in the `ref`
    // callback of that render already sees the disabled select.
    expect(clicked).toBe(true);
    expect(handleValueChange).not.toHaveBeenCalled();
    expect(item).toHaveAttribute('data-disabled');
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
