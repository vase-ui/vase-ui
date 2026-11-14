import { expect, vi, describe, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import * as Select from './index.parts';
import { useSelectRootContext } from './root/SelectRootContext';
import type { SelectStore } from './store';

describe('select store synchronization', () => {
  const { render } = createRenderer();

  it('publishes synchronized values in a single store transaction', async () => {
    type Snapshot = { id: string | undefined; modal: boolean; disabled: boolean };
    const snapshots: Snapshot[] = [];

    // A part reads the store in its render. Each render records the values that it sees.
    const SnapshotProbe = defineComponent(() => {
      const store = useSelectRootContext();
      return () => {
        const { id, modal, disabled } = store.state;
        snapshots.push({ id, modal, disabled });
        return null;
      };
    });

    const SynchronizationFixture = defineComponent({
      props: {
        id: { type: String, required: true },
        modal: { type: Boolean, required: true },
        disabled: { type: Boolean, required: true },
      },
      setup: (props) => () => (
        <Select.Root id={props.id} modal={props.modal} disabled={props.disabled}>
          <SnapshotProbe />
          <Select.Trigger />
        </Select.Root>
      ),
    });

    const { setProps } = await render(<SynchronizationFixture id="first" modal disabled={false} />);
    snapshots.length = 0;

    await setProps({ id: 'second', modal: false, disabled: true });

    expect(snapshots.some((snapshot) => snapshot.id === 'second' && snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && !snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'second' && !snapshot.disabled)).toBe(
      false,
    );
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && snapshot.disabled)).toBe(false);
    expect(snapshots).toContainEqual({ id: 'second', modal: false, disabled: true });
  });

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
    let store!: SelectStore;

    const StoreProbe = defineComponent(() => {
      store = useSelectRootContext();
      return () => null;
    });

    const Fixture = defineComponent({
      props: { disabled: { type: Boolean, required: true } },
      setup: (props) => () => (
        <Select.Root defaultOpen disabled={props.disabled} onValueChange={handleValueChange}>
          <StoreProbe />
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
    // A click with no pointer selects only a highlighted item.
    store.set('activeIndex', 0);
    await flushMicrotasks();
    expect(item).toHaveAttribute('data-highlighted');

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
