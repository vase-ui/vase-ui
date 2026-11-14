import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue';
import type { PropType } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hiddenInputTypeTests,
  hydrate,
  isJSDOM,
  nextEvent,
  popupConformanceTests,
  pressWithTouch,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { actOnElement } from '../../../test/fixtures/actOnElement';
import { isScrollLocked } from '../../../test/fixtures/scrollDocument';
import { platform } from '../../common/platform';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as SelectSeparatorDataAttributes from '../../separator/SeparatorDataAttributes';
import * as Select from '../index.parts';
import type { SelectStore } from '../store';
import { useSelectRootContext } from './SelectRootContext';
import SelectRootHydration from './SelectRootHydration.test.vue';

const isWebKit = platform.engine.webkit;

type ChangeDetails = Select.Root.ChangeEventDetails;
type OpenChangeDetails = Select.Root.OpenChangeEventDetails;

// The cases set the value through the store, as an item does, so they need no popup.
let store: SelectStore;
const StoreProbe = defineComponent(() => {
  store = useSelectRootContext();
  return () => null;
});

async function setValueAsItem(value: unknown) {
  const accepted = store.context.setValue(value, createChangeEventDetails(REASONS.itemPress));
  await flushMicrotasks();
  return accepted;
}

async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

// The trigger mounts the items in a 0 ms timer after it gets the focus. `flushMicrotasks` resolves
// in the next task, and a browser can run that task before the task of the timer.
async function focusTrigger(trigger: HTMLElement) {
  trigger.focus();
  await waitFor(() => {
    expect(document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
  });
}

function getHiddenInput() {
  return document.querySelector<HTMLInputElement>('input[aria-hidden]')!;
}

function getFormData(name: string) {
  return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll(name);
}

describe('<Select.Root />', () => {
  const { render } = createRenderer();

  describe('closing before the popup attaches', () => {
    it('finishes closing when a layout effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent(() => {
        const open = shallowRef(true);
        onMounted(() => {
          open.value = false;
        });
        return () => (
          <Select.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">Apple</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      await render(<App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      // A closed select keeps its list mounted and hidden, as after any other close. The focus
      // goes to the trigger, and the trigger mounts the list in a 0 ms timer.
      expect(await screen.findByRole('listbox', { hidden: true })).not.toHaveAttribute(
        'data-ending-style',
      );
    });

    it('finishes closing when a layout effect closes it right after a press opens it', async () => {
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent(() => {
        const open = shallowRef(false);
        watch(
          open,
          (isOpen) => {
            if (isOpen) {
              open.value = false;
            }
          },
          { flush: 'post' },
        );
        return () => (
          <Select.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">Apple</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      // The press mounts the list while closed so its items can register; it isn't left closing.
      expect(screen.getByRole('listbox', { hidden: true })).not.toHaveAttribute(
        'data-ending-style',
      );
    });
  });

  it('exposes the orientation attribute rendered by Separator', async () => {
    await render(<Select.Separator orientation="vertical" />);

    const separator = screen.getByRole('presentation');
    expect(separator).toHaveAttribute(SelectSeparatorDataAttributes.orientation, 'vertical');
  });

  describe('manual unmount lifecycle', () => {
    const Popup = defineComponent({
      props: {
        open: { type: Boolean, default: undefined },
        defaultOpen: Boolean,
        actionsRef: Function as PropType<(actions: Select.Root.Actions) => void>,
        onOpenChange: Function as PropType<(open: boolean, details: OpenChangeDetails) => void>,
        onOpenChangeComplete: Function as PropType<(open: boolean) => void>,
      },
      setup(props) {
        const open = shallowRef(props.defaultOpen);
        return () => (
          <Select.Root
            ref={(instance: unknown) => {
              if (instance) {
                props.actionsRef?.(instance as Select.Root.Actions);
              }
            }}
            open={props.open ?? open.value}
            onOpenChange={(nextOpen: boolean, details: OpenChangeDetails) => {
              props.onOpenChange?.(nextOpen, details);
              if (!details.isCanceled) {
                open.value = nextOpen;
              }
            }}
            onOpenChangeComplete={(nextOpen: boolean) => props.onOpenChangeComplete?.(nextOpen)}
          >
            <Select.Trigger />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">Apple</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      },
    });

    function closeCount(onOpenChangeComplete: ReturnType<typeof vi.fn>) {
      return onOpenChangeComplete.mock.calls.filter(([open]) => !open).length;
    }

    it('automatically unmounts with an actions ref and completes closing once', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup
          actionsRef={(value) => (actions = value)}
          onOpenChangeComplete={onOpenChangeComplete}
        />,
      );

      expect(onOpenChangeComplete).not.toHaveBeenCalled();
      await user.click(screen.getByRole('combobox'));
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCount(onOpenChangeComplete)).toBe(1);

      // Calling the action after the automatic unmount must not repeat the completion.
      actions.unmount();
      await flushMicrotasks();
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it('keeps the popup mounted until the unmount action completes closing', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = await render(
        <Popup
          defaultOpen
          actionsRef={(value) => (actions = value)}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );
      await flushMicrotasks();

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      actions.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCount(onOpenChangeComplete)).toBe(1);

      await setProps({ open: true });
      await screen.findByRole('listbox');
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCount(onOpenChangeComplete)).toBe(2);
    });

    it('clears the opt-out when a controlled reopen interrupts a pending unmount', async () => {
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = await render(
        <Popup
          defaultOpen
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );
      await flushMicrotasks();

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      await setProps({ open: true });
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it('ignores an opt-out on a canceled close', async () => {
      let cancel = true;
      const { user } = await render(
        <Popup
          defaultOpen
          onOpenChange={(open, details) => {
            if (!open && cancel) {
              details.preventUnmountOnClose();
              details.cancel();
            }
          }}
        />,
      );
      await flushMicrotasks();

      await user.click(screen.getByRole('option'));
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      cancel = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });

    it('keeps the opt-out when a controlled close is applied in a transition', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      const App = defineComponent(() => {
        const open = shallowRef(true);
        return () => (
          <Popup
            open={open.value}
            actionsRef={(value) => (actions = value)}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen) {
                details.preventUnmountOnClose();
              }
              // A transition of React renders the state in a later task.
              setTimeout(() => {
                open.value = nextOpen;
              });
            }}
          />
        );
      });

      const { user } = await render(<App />);
      await flushMicrotasks();
      await user.click(screen.getByRole('option'));
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'),
      );
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actions.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it('closes through the `close` action so `onOpenChange` can opt out', async () => {
      let actions!: Select.Root.Actions;
      const reasons: string[] = [];
      await render(
        <Popup
          defaultOpen
          actionsRef={(value) => (actions = value)}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );
      await flushMicrotasks();

      actions.close();
      await flushMicrotasks();
      expect(reasons).toEqual([REASONS.imperativeAction]);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actions.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('ignores `unmount` while the popup is open', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      await render(
        <Popup
          defaultOpen
          actionsRef={(value) => (actions = value)}
          onOpenChangeComplete={onOpenChangeComplete}
        />,
      );
      await flushMicrotasks();
      const popup = screen.getByRole('listbox');

      actions.unmount();
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toBe(popup);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    });

    it('unmounts when `close` and `unmount` are called in one batch', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      await render(
        <Popup
          defaultOpen
          actionsRef={(value) => (actions = value)}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );
      await flushMicrotasks();

      actions.close();
      actions.unmount();
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });

    it('still unmounts on a later close after `unmount` was called while open', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup
          defaultOpen
          actionsRef={(value) => (actions = value)}
          onOpenChangeComplete={onOpenChangeComplete}
        />,
      );
      await flushMicrotasks();

      // A stale exit-animation callback can call `unmount()` after a quick reopen.
      actions.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it('still unmounts on a later close after `unmount` and a reopen in one batch', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      let reopenOnComplete = true;
      let optOut = true;
      const App = defineComponent(() => {
        const open = shallowRef(true);
        return () => (
          <Popup
            open={open.value}
            actionsRef={(value) => (actions = value)}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen && optOut) {
                details.preventUnmountOnClose();
              }
              open.value = nextOpen;
            }}
            onOpenChangeComplete={(nextOpen) => {
              onOpenChangeComplete(nextOpen);
              // An exit-animation callback that reopens right after it unmounts.
              if (!nextOpen && reopenOnComplete) {
                reopenOnComplete = false;
                open.value = true;
              }
            }}
          />
        );
      });

      const { user } = await render(<App />);
      await flushMicrotasks();
      actions.close();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actions.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(closeCount(onOpenChangeComplete)).toBe(1);

      optOut = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCount(onOpenChangeComplete)).toBe(2);
    });

    it('completes closing once when `unmount` is called twice in one batch', async () => {
      let actions!: Select.Root.Actions;
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup
          defaultOpen
          actionsRef={(value) => (actions = value)}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );
      await flushMicrotasks();

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actions.unmount();
      actions.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCount(onOpenChangeComplete)).toBe(1);
    });
  });

  describe('conformance', () => {
    popupConformanceTests({
      createComponent: (props) => (
        <Select.Root {...props.root}>
          <Select.Trigger {...props.trigger}>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal {...props.portal}>
            <Select.Positioner>
              <Select.Popup {...props.popup}>
                <Select.Item>Item</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ),
      render,
      triggerMouseAction: 'click',
      expectedPopupRole: 'listbox',
      alwaysMounted: 'only-after-open',
    });
  });

  describe('prop: defaultValue', () => {
    it('should select the item by default', async () => {
      await render(
        <Select.Root defaultValue="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.click(trigger);

      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  describe('prop: value', () => {
    it('should select the item specified by the value prop', async () => {
      await render(
        <Select.Root value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.click(trigger);

      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });

    it('selects the controlled value when the popup is mounted on the initial render', async () => {
      await render(
        <Select.Root defaultOpen value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it('should update the selected item when the value prop changes', async () => {
      const { setProps } = await render(
        <Select.Root value="a">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.click(trigger);

      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );

      await setProps({ value: 'b' });

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it.each([
      { name: 'single', multiple: false, initialValue: 'dave', nextValue: 'bob' },
      { name: 'multiple', multiple: true, initialValue: ['dave'], nextValue: ['bob'] },
    ])(
      'keeps a new controlled value and focus in $name mode when the previous item is removed in the same update',
      async ({ multiple, initialValue, nextValue }) => {
        const onValueChange = vi.fn();

        const Test = defineComponent(() => {
          const options = shallowRef(['alice', 'bob', 'carol', 'dave']);
          const value = shallowRef<string | string[] | null>(initialValue);

          return () => (
            <div>
              <Select.Root
                multiple={multiple}
                value={value.value as any}
                onValueChange={(next: any, details: ChangeDetails) => {
                  onValueChange(next, details);
                  value.value = next;
                }}
                open
                modal={false}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.List>
                        {options.value.map((option) => (
                          <Select.Item key={option} value={option}>
                            {option}
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
              <button
                type="button"
                onClick={() => {
                  options.value = ['alice', 'bob'];
                  value.value = nextValue;
                }}
              >
                Update options and value
              </button>
              <output data-testid="value">{JSON.stringify(value.value)}</output>
            </div>
          );
        });

        const { user } = await render(<Test />);
        expect(await screen.findByRole('option', { name: 'dave' })).toHaveAttribute(
          'data-selected',
        );
        const alice = screen.getByRole('option', { name: 'alice' });
        alice.focus();
        await flushMicrotasks();
        expect(alice).toHaveFocus();
        expect(alice).toHaveAttribute('data-highlighted');

        // Simulate an external update without moving focus away from the surviving item.
        await fireEvent.click(screen.getByRole('button', { name: 'Update options and value' }));

        expect(screen.getByTestId('value').textContent).toBe(JSON.stringify(nextValue));
        expect(screen.getByRole('option', { name: 'bob' })).toHaveAttribute('data-selected');
        expect(onValueChange).not.toHaveBeenCalled();
        expect(alice).toHaveFocus();
        expect(alice).toHaveAttribute('data-highlighted');

        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('option', { name: 'bob' })).toHaveFocus();
      },
    );

    it('uses the current multiple setting when options and value change together', async () => {
      const onValueChange = vi.fn();

      const Test = defineComponent(() => {
        const multiple = shallowRef(false);
        const value = shallowRef<string | string[]>('alice');
        const options = shallowRef(['alice', 'bob', 'carol']);

        return () => (
          <div>
            <Select.Root
              multiple={multiple.value}
              value={value.value as any}
              onValueChange={onValueChange}
              open
              modal={false}
            >
              <Select.Trigger />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {options.value.map((option) => (
                      <Select.Item key={option} value={option}>
                        {option}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              type="button"
              onClick={() => {
                multiple.value = true;
                value.value = ['alice'];
                options.value = ['alice', 'bob'];
              }}
            >
              Update selection
            </button>
          </div>
        );
      });

      const { user } = await render(<Test />);
      await flushMicrotasks();
      expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-multiselectable');
      expect(screen.getByRole('option', { name: 'carol' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Update selection' }));

      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
      expect(screen.queryByRole('option', { name: 'carol' })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'alice' })).toHaveAttribute('data-selected', '');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('uses the current comparator when options and value change together', async () => {
      const onValueChange = vi.fn();
      const alice = { id: 'alice' };
      const bob = { id: 'bob' };
      const carol = { id: 'carol' };

      const Test = defineComponent(() => {
        const compareById = shallowRef(false);
        const value = shallowRef(alice);
        const options = shallowRef([alice, bob, carol]);

        return () => (
          <div>
            <Select.Root
              value={value.value}
              isItemEqualToValue={
                compareById.value
                  ? (item: { id: string }, selected: { id: string }) => item.id === selected.id
                  : Object.is
              }
              onValueChange={onValueChange}
              open
              modal={false}
            >
              <Select.Trigger />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {options.value.map((option) => (
                      <Select.Item key={option.id} value={option}>
                        {option.id}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              type="button"
              onClick={() => {
                compareById.value = true;
                value.value = { id: 'bob' };
                options.value = [alice, bob];
              }}
            >
              Update selection
            </button>
          </div>
        );
      });

      const { user } = await render(<Test />);
      await user.click(screen.getByRole('button', { name: 'Update selection' }));

      expect(screen.getByRole('option', { name: 'bob' })).toHaveAttribute('data-selected', '');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should not update the internal value if the controlled value prop does not change', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Select.Root value="a" onValueChange={onValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('a');

      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'b' }));

      expect(onValueChange).toHaveBeenCalledOnce();
      expect(onValueChange.mock.calls[0][0]).toBe('b');
      expect(trigger).toHaveTextContent('a');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(trigger);

      expect(await screen.findByRole('option', { name: 'a' })).toHaveAttribute('data-selected');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');
    });

    it('updates <Select.Value /> label when the value prop changes before the popup opens', async () => {
      const { setProps } = await render(
        <Select.Root value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveTextContent('b');

      await setProps({ value: 'a' });
      await flushMicrotasks();

      expect(trigger).toHaveTextContent('a');
    });
  });

  describe('prop: itemToStringValue', () => {
    it('uses itemToStringValue for form submission', async () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
        { country: 'Australia', code: 'AU' },
      ];

      await render(
        <Select.Root
          name="country"
          defaultValue={items[0]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', {
        hidden: true,
      });
      expect(hiddenInput).toHaveValue('US');
    });

    it('uses itemToStringValue for multiple selection form submission', async () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
        { country: 'Australia', code: 'AU' },
      ];

      const { container } = await render(
        <Select.Root
          name="countries"
          multiple
          defaultValue={[items[0], items[1]]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const hiddenInputs = container.querySelectorAll('input[name="countries"]');
      expect(hiddenInputs).toHaveLength(2);
      expect(hiddenInputs[0]).toHaveValue('US');
      expect(hiddenInputs[1]).toHaveValue('CA');
    });

    it('does not invoke itemToStringValue with the value array in multiple mode', async () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
      ];

      // A user `itemToStringValue` written for a single item throws if invoked with the whole
      // array. The shared hidden input is nameless in multiple mode, so it must not serialize
      // the array (per-value inputs carry the data). Rendering succeeding is the regression guard.
      const { container } = await render(
        <Select.Root
          name="countries"
          multiple
          defaultValue={[items[0], items[1]]}
          itemToStringValue={(item) => item.code.toUpperCase()}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const hiddenInputs = container.querySelectorAll('input[name="countries"]');
      expect(hiddenInputs).toHaveLength(2);
      expect(hiddenInputs[0]).toHaveValue('US');
      expect(hiddenInputs[1]).toHaveValue('CA');
    });
  });

  describe('prop: itemToStringLabel', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringLabel for trigger text when value is object', async () => {
      await render(
        <Select.Root
          defaultValue={items[1]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('Canada');
    });

    it('updates trigger text with itemToStringLabel after selecting object item', async () => {
      const { user } = await render(
        <Select.Root
          defaultOpen
          itemToStringLabel={(item: any) => item.country}
          itemToStringValue={(item: any) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      await user.click(screen.getByRole('option', { name: 'Canada' }));
      expect(screen.getByTestId('trigger')).toHaveTextContent('Canada');
    });
  });

  describe('prop: onValueChange', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call onValueChange when an item is selected', async () => {
      const handleValueChange = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<string | null>('');

        return () => (
          <Select.Root
            value={value.value}
            onValueChange={(newValue: string | null) => {
              value.value = newValue;
              handleValueChange(newValue);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();
      await user.click(option);

      expect(handleValueChange.mock.calls[0][0]).toBe('b');
    });

    it('is not called twice on select', async () => {
      const handleValueChange = vi.fn();

      const { user } = await render(
        <Select.Root onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      await vi.advanceTimersByTimeAsync(200);
      await flushMicrotasks();
      await user.click(option);

      expect(handleValueChange.mock.calls.length).toBe(1);
    });
  });

  describe('prop: defaultOpen', () => {
    it('should open the select by default', async () => {
      await render(
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const listbox = screen.getByRole('listbox', { hidden: false });
      expect(listbox).toBeVisible();
      // `listbox` is implicitly vertical.
      expect(listbox).not.toHaveAttribute('aria-orientation');
    });

    it('should select an item and close when clicked while opened by default', async () => {
      const handleValueChange = vi.fn();

      const { user } = await render(
        <Select.Root defaultOpen onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeVisible();

      const optionB = screen.getByRole('option', { name: 'b' });

      await fireEvent.mouseMove(optionB);
      await user.click(optionB);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('b');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });
  });

  it('should handle browser autofill', async () => {
    const { user } = await render(
      <Select.Root name="select">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    const selectInput = screen.getByRole('textbox', {
      hidden: true,
    });
    expect(selectInput).toHaveAttribute('name', 'select');
    await fireEvent.input(selectInput, { target: { value: 'b' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
    });
  });

  it('ignores browser autofill in multiple mode', async () => {
    const handleValueChange = vi.fn();

    await render(
      <Select.Root multiple name="select" onValueChange={handleValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const selectInput = screen.getByRole('textbox', { hidden: true });

    // Autofill only ever writes a single scalar, which can't be meaningfully applied to a
    // multi-selection, so it must be dropped rather than collapsing the value to one item.
    await fireEvent.input(selectInput, { target: { value: 'b' } });
    await flushMicrotasks();

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('leaves the value untouched when autofill matches no item', async () => {
    const handleValueChange = vi.fn();

    await render(
      <Select.Root name="select" defaultValue="a" onValueChange={handleValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    await fireEvent.input(selectInput, { target: { value: 'not-an-option' } });
    await flushMicrotasks();

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent('a');
  });

  it('redirects focus to the trigger when the hidden input is focused', async () => {
    await render(
      <Select.Root name="select">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    // Browsers can focus the visually hidden input (for example when validation reports an
    // error on it); focus has to land on the visible control instead.
    selectInput.focus();
    await flushMicrotasks();

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('should pass autoComplete to the hidden input', async () => {
    await render(
      <Select.Root name="country" autoComplete="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="US">United States</Select.Item>
              <Select.Item value="CA">Canada</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const hiddenInput = screen.getByRole('textbox', { hidden: true });
    expect(hiddenInput).toHaveAttribute('name', 'country');
    expect(hiddenInput).toHaveAttribute('autocomplete', 'country');
  });

  it('should handle browser autofill with object values', async () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    const { user } = await render(
      <Select.Root
        name="country"
        itemToStringLabel={(item: any) => item.country}
        itemToStringValue={(item: any) => item.code}
      >
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              {items.map((it) => (
                <Select.Item key={it.code} value={it}>
                  {it.country}
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    const selectInput = screen.getByRole('textbox', {
      hidden: true,
    });
    expect(selectInput).toHaveAttribute('name', 'country');
    await fireEvent.input(selectInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  it('should handle browser autofill with object values when autofill uses the label', async () => {
    // Browsers autofill with the displayed text (label), not the underlying value.
    // For example, Chrome will autofill "United States" (the label), not "US" (the value).
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    const { user } = await render(
      <Select.Root
        name="country"
        itemToStringLabel={(item: any) => item.country}
        itemToStringValue={(item: any) => item.code}
      >
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              {items.map((it) => (
                <Select.Item key={it.code} value={it}>
                  {it.country}
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    const selectInput = screen.getByRole('textbox', {
      hidden: true,
    });
    expect(selectInput).toHaveAttribute('name', 'country');

    // Simulate browser autofill with the LABEL (displayed text), not the value
    await fireEvent.input(selectInput, { target: { value: 'Canada' } }); // Browser sends "Canada" (label), not "CA" (value)
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  it('matches browser autofill against an item rendered label for primitive values regardless of case', async () => {
    const { user } = await render(
      <Select.Root name="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="US">United States</Select.Item>
              <Select.Item value="CA">Canada</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    await fireEvent.input(selectInput, { target: { value: 'canada' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  it('matches browser autofill by serialized value before an earlier rendered label', async () => {
    const { user } = await render(
      <Select.Root name="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="CA">US</Select.Item>
              <Select.Item value="US">United States</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    await fireEvent.input(selectInput, { target: { value: 'US' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'United States', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
    expect(screen.getByRole('option', { name: 'US', hidden: false })).not.toHaveAttribute(
      'data-selected',
    );
  });

  it('matches browser autofill when an earlier item has no rendered label', async () => {
    const { user } = await render(
      <Select.Root name="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="US">{null}</Select.Item>
              <Select.Item value="CA">Canada</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    await fireEvent.input(selectInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  it('marks the field dirty and validates after successful autofill', async () => {
    const validateSpy = vi.fn((value: unknown) => {
      return value === 'CA' ? null : 'error';
    });

    await render(
      <Field.Root validationMode="onChange" validate={validateSpy}>
        <Select.Root name="country">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="US">United States</Select.Item>
                <Select.Item value="CA">Canada</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    expect(trigger).not.toHaveAttribute('data-dirty');

    await fireEvent.input(selectInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
    });

    expect(validateSpy.mock.calls[validateSpy.mock.calls.length - 1][0]).toBe('CA');
    expect(trigger).toHaveAttribute('data-dirty', '');
  });

  it('does not update field state when autofill is canceled', async () => {
    await render(
      <Form errors={{ country: 'server error' }}>
        <Field.Root name="country">
          <Select.Root
            onValueChange={(_value: unknown, eventDetails: ChangeDetails) => {
              eventDetails.cancel();
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="US">United States</Select.Item>
                  <Select.Item value="CA">Canada</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');

    await fireEvent.input(selectInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');
  });

  it('removes [data-dirty] in multiple mode after returning to the initial value', async () => {
    const { user } = await render(
      <Field.Root>
        <Select.Root multiple defaultOpen defaultValue={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const optionB = await screen.findByRole('option', { name: 'b' });

    expect(trigger).not.toHaveAttribute('data-dirty');

    await user.click(optionB);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    await user.click(optionB);

    await waitFor(() => {
      expect(trigger).not.toHaveAttribute('data-dirty');
    });
  });

  it('compares object values with isItemEqualToValue when clearing [data-dirty] in multiple mode', async () => {
    const items = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ];

    const { user } = await render(
      <Field.Root>
        <Select.Root
          multiple
          defaultOpen
          // A distinct object reference from `items[0]`, but equal to it via `isItemEqualToValue`.
          defaultValue={[{ value: 'a', label: 'a' }]}
          isItemEqualToValue={(a, b) => a.value === b.value}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={items[0]}>a</Select.Item>
                <Select.Item value={items[1]}>b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const optionA = await screen.findByRole('option', { name: 'a' });

    expect(trigger).not.toHaveAttribute('data-dirty');

    // Deselect the initial item, then reselect it. The reselected value is `items[0]`,
    // a different object reference than the initial `defaultValue` object, so a reference
    // comparison would incorrectly report dirty.
    await user.click(optionA);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    await user.click(optionA);

    await waitFor(() => {
      expect(trigger).not.toHaveAttribute('data-dirty');
    });
  });

  it('does not invoke isItemEqualToValue with the value array in multiple mode when empty', async () => {
    const items = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ];

    // A custom `isItemEqualToValue` is written for single items. Before the fix, an empty
    // selection in multiple mode handed the raw `[]` to the comparer (`[]` is non-null, so
    // `compareItemEquality` forwarded it), causing the comparer to run against the array.
    // It must instead be compared against `undefined` (nothing selected), so the comparer
    // is never invoked here. `defaultOpen` ensures the items mount and run the registration
    // effect that used to call the comparer with the raw array.
    const isItemEqualToValue = vi.fn((a: { value: string }, b: { value: string }) => {
      if (Array.isArray(b)) {
        throw new Error('isItemEqualToValue received the value array');
      }
      return a.value === b.value;
    });

    await render(
      <Select.Root multiple defaultOpen defaultValue={[]} isItemEqualToValue={isItemEqualToValue}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value={items[0]}>a</Select.Item>
              <Select.Item value={items[1]}>b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    expect(screen.getByTestId('trigger')).not.toBeNull();
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(isItemEqualToValue).not.toHaveBeenCalledWith(expect.anything(), expect.any(Array));
  });

  it('keeps [data-dirty] in multiple mode when the same values return in a different order', async () => {
    const { user } = await render(
      <Field.Root>
        <Select.Root multiple defaultOpen defaultValue={['a', 'b']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const optionA = await screen.findByRole('option', { name: 'a' });

    expect(trigger).not.toHaveAttribute('data-dirty');

    // Deselect `a` (value becomes `['b']`), then reselect it (value becomes `['b', 'a']`).
    // The set of values matches the initial `['a', 'b']`, but the order differs, so the
    // field stays dirty: the comparison is order-sensitive.
    await user.click(optionA);
    await user.click(optionA);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-dirty', '');
    });
  });

  it.each([
    { lockState: 'readOnly', label: 'inside Field', withField: true },
    { lockState: 'disabled', label: 'inside Field', withField: true },
    { lockState: 'readOnly', label: 'outside Field', withField: false },
    { lockState: 'disabled', label: 'outside Field', withField: false },
  ] as const)(
    'ignores hidden-input autofill when $lockState $label',
    async ({ lockState, withField }) => {
      const onValueChange = vi.fn();
      const select = (
        <Select.Root
          name={withField ? undefined : 'select'}
          readOnly={lockState === 'readOnly'}
          disabled={lockState === 'disabled'}
          onValueChange={onValueChange}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );

      await render(
        withField ? (
          <Form errors={{ select: 'test' }}>
            <Field.Root name="select">
              {select}
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ) : (
          select
        ),
      );

      const selectInput = screen.getByRole<HTMLInputElement>('textbox', { hidden: true });
      expect(selectInput).toHaveAttribute('name', 'select');

      // Only the Field wrapper renders an error.
      const expectedError = withField ? 'test' : undefined;

      expect(screen.queryByTestId('error')?.textContent).toBe(expectedError);

      await fireEvent.input(selectInput, { target: { value: 'b' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(selectInput.value).toBe('');

      expect(screen.queryByTestId('error')?.textContent).toBe(expectedError);
    },
  );

  it.each(['disabled', 'readOnly'] as const)(
    'does not commit item selection when root is %s and forced open',
    async (lockState) => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Select.Root
          open
          onValueChange={onValueChange}
          disabled={lockState === 'disabled'}
          readOnly={lockState === 'readOnly'}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      await user.click(screen.getByRole('option', { name: 'b', hidden: false }));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'b', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    },
  );

  describe('prop: modal', () => {
    it('should render an internal backdrop when `true`', async () => {
      const { user } = await render(
        <div>
          <Select.Root modal>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button>Outside</button>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const positioner = screen.getByTestId('positioner');

      expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
    });

    it('should not render an internal backdrop when `false`', async () => {
      const { user } = await render(
        <div>
          <Select.Root modal={false}>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button>Outside</button>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const positioner = screen.getByTestId('positioner');

      expect(positioner.previousElementSibling).toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('scroll locking', () => {
    describe('interaction type tracking (openMethod)', () => {
      it('keeps touch interaction type when reopening quickly after close', async ({
        onTestFinished,
      }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        let nextFrameId = 0;
        const frameCallbacks = new Map<number, FrameRequestCallback>();

        const requestAnimationFrameSpy = vi
          .spyOn(window, 'requestAnimationFrame')
          .mockImplementation((callback: FrameRequestCallback) => {
            nextFrameId += 1;
            frameCallbacks.set(nextFrameId, callback);
            return nextFrameId;
          });
        const cancelAnimationFrameSpy = vi
          .spyOn(window, 'cancelAnimationFrame')
          .mockImplementation((id: number) => {
            frameCallbacks.delete(id);
          });

        onTestFinished(() => {
          requestAnimationFrameSpy.mockRestore();
          cancelAnimationFrameSpy.mockRestore();
          globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes select-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: select-close-test 20ms linear;
          }
        `;

        await render(
          <div>
            <style>{style}</style>
            <Select.Root modal>
              <Select.Trigger>Open</Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup class="animation-test-indicator">
                    <Select.Item>Item</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByRole('combobox');

        function flushAnimationFrames() {
          let iterations = 0;
          while (frameCallbacks.size > 0) {
            if (iterations > 20) {
              throw new Error('Exceeded maximum animation frame flush iterations.');
            }

            const pending = Array.from(frameCallbacks.values());
            frameCallbacks.clear();
            pending.forEach((callback) => {
              callback(0);
            });
            iterations += 1;
          }
        }

        await pressWithTouch(trigger);
        flushAnimationFrames();
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });

        await pressWithTouch(trigger);

        flushAnimationFrames();
        await flushMicrotasks();

        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });

        // Re-open while the previous close animation is still pending.
        await pressWithTouch(trigger);

        flushAnimationFrames();
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });

        await wait(30);

        expect(isScrollLocked(trigger.ownerDocument)).toBe(false);
      });

      it('keeps touch positioning during the close transition', async ({ onTestFinished }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes select-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: select-close-test 100ms linear;
          }
        `;

        await render(
          <div style={{ paddingTop: '80px' }}>
            <style>{style}</style>
            <Select.Root>
              <Select.Trigger>Open</Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup class="animation-test-popup">
                    <Select.Item>Item</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByRole('combobox');

        await pressWithTouch(trigger);

        const popup = await screen.findByRole('listbox');
        const positioner = popup.parentElement as HTMLElement;

        await waitFor(() => {
          expect(getComputedStyle(positioner).position).toBe('absolute');
        });

        // The exit lasts 100 ms. The observer records the position while the popup has
        // `data-ending-style`, and the record stays after the exit.
        const positionsWhileEnding: string[] = [];
        const observer = new MutationObserver(() => {
          if (popup.hasAttribute('data-ending-style')) {
            positionsWhileEnding.push(getComputedStyle(positioner).position);
          }
        });
        observer.observe(popup, { attributeFilter: ['data-ending-style'] });
        onTestFinished(() => observer.disconnect());

        await pressWithTouch(trigger);

        await waitFor(() => {
          expect(positionsWhileEnding.length).toBeGreaterThan(0);
        });

        expect(positionsWhileEnding[0]).toBe('absolute');
      });

      it('keeps the selected item highlighted when reopening after a touch-driven mouseleave', async () => {
        await render(
          <Select.Root>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const trigger = screen.getByRole('combobox');

        await pressWithTouch(trigger);

        await waitFor(() => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        const optionB = screen.getByRole('option', { name: 'b' });
        await fireEvent.pointerDown(optionB, { pointerType: 'touch' });
        await fireEvent.click(optionB);
        await fireEvent.mouseLeave(optionB, { clientX: -1, clientY: -1 });

        await pressWithTouch(trigger);

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-highlighted');
        });
      });

      it('recomputes positioning before the popup becomes visible again after touch dismiss', async ({
        onTestFinished,
      }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        onTestFinished(() => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
        });

        const onOpenChangeComplete = vi.fn();
        const items = Array.from({ length: 80 }, (_, index) => `Item ${index + 1}`);
        const style = `
          @keyframes select-reopen-test {
            to {
              opacity: 0;
              transform: scale(0.9);
            }
          }

          .reopen-test-popup {
            width: 120px;
            transition:
              transform 150ms,
              opacity 150ms;
          }

          .reopen-test-popup[data-starting-style],
          .reopen-test-popup[data-ending-style] {
            animation: select-reopen-test 20ms linear;
          }

          .reopen-test-list {
            max-height: var(--available-height);
            overflow-y: auto;
          }
        `;

        const Test = defineComponent(() => {
          const open = shallowRef(false);
          const paddingTop = shallowRef(0);
          const trigger = shallowRef<{ element: HTMLElement | null } | null>(null);

          // The loop puts the bottom of the trigger 100 px above the bottom of the viewport.
          function placeTrigger() {
            const element = trigger.value?.element;
            if (!element) {
              return;
            }

            const gap =
              document.documentElement.clientHeight - element.getBoundingClientRect().bottom;
            if (Math.abs(gap - 100) <= 1) {
              return;
            }

            paddingTop.value += gap - 100;
          }

          onMounted(placeTrigger);
          watch(paddingTop, placeTrigger, { flush: 'post' });

          return () => (
            <div style={{ paddingTop: `${paddingTop.value}px` }}>
              <style>{style}</style>
              <button data-testid="outside">Outside</button>
              <Select.Root
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  open.value = nextOpen;
                }}
                onOpenChangeComplete={onOpenChangeComplete}
              >
                <Select.Trigger ref={trigger}>Open</Select.Trigger>
                <Select.Portal>
                  <Select.Positioner data-testid="positioner" sideOffset={8}>
                    <Select.Popup class="reopen-test-popup">
                      <Select.ScrollUpArrow />
                      <Select.Arrow />
                      <Select.List class="reopen-test-list">
                        <div aria-hidden="true" style={{ height: '75px' }}>
                          Start
                        </div>
                        {items.map((item) => (
                          <Select.Item key={item} value={item}>
                            {item}
                          </Select.Item>
                        ))}
                        <div aria-hidden="true" style={{ height: '75px' }}>
                          End
                        </div>
                      </Select.List>
                      <Select.ScrollDownArrow />
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>
          );
        });

        const { user } = await render(<Test />);

        const trigger = screen.getByRole('combobox');
        const outside = screen.getByTestId('outside');

        await waitFor(() => {
          const gap =
            document.documentElement.clientHeight - trigger.getBoundingClientRect().bottom;
          expect(Math.abs(gap - 100)).toBeLessThanOrEqual(1);
        });

        await pressWithTouch(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });

        const initialPositioner = screen.getByTestId('positioner');

        await waitFor(() => {
          expect(initialPositioner).toHaveAttribute('data-side', 'top');
        });

        await pressWithTouch(outside);

        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls.some(([value]) => value === false)).toBe(true);
        });
        await waitFor(() => {
          expect(screen.getByTestId('positioner').style.opacity).toBe('0');
        });

        await pressWithTouch(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('positioner').style.opacity).not.toBe('0');
        });

        const reopenedPositioner = screen.getByTestId('positioner');
        const reopenedList = screen.getByRole('listbox');
        expect(reopenedPositioner).toHaveAttribute('data-side', 'top');
        expect(reopenedList.getBoundingClientRect().height).toBeGreaterThan(200);

        await user.click(outside);
      });
    });

    describe('touch scroll lock', () => {
      it('applies scroll lock when a touch-opened popup covers the viewport width', async () => {
        await render(
          <Select.Root modal>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        await pressWithTouch(trigger);

        await screen.findByRole('listbox');

        await waitFor(() => {
          expect(isScrollLocked(trigger.ownerDocument)).toBe(true);
        });
      });

      it('does not apply scroll lock when a touch-opened popup is narrower than the viewport', async () => {
        await render(
          <Select.Root modal>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" style={{ width: '240px' }}>
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        await pressWithTouch(trigger);

        await screen.findByRole('listbox');

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        await flushMicrotasks();

        expect(isScrollLocked(trigger.ownerDocument)).toBe(false);
      });
    });
  });

  describe('prop: actionsRef', () => {
    it('unmounts the select when the `unmount` method is called', async () => {
      let actions!: Select.Root.Actions;

      const { user } = await render(() => (
        <Select.Root
          ref={(instance: unknown) => {
            if (instance) {
              actions = instance as Select.Root.Actions;
            }
          }}
          onOpenChange={(_open: boolean, details: OpenChangeDetails) =>
            details.preventUnmountOnClose()
          }
        >
          <Select.Trigger data-testid="trigger">Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item>1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
      actions.unmount();
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('clears scroll arrow visibility when manually unmounted (strict: %s)', async () => {
      let actions!: Select.Root.Actions;

      const { user } = await render(() => (
        <Select.Root
          ref={(instance: unknown) => {
            if (instance) {
              actions = instance as Select.Root.Actions;
            }
          }}
          onOpenChange={(_open: boolean, details: OpenChangeDetails) =>
            details.preventUnmountOnClose()
          }
        >
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List
                  v-slots={actOnElement(
                    'div',
                    (node) => {
                      Object.defineProperties(node, {
                        scrollTop: { configurable: true, value: 20, writable: true },
                        scrollHeight: { configurable: true, value: 100 },
                        clientHeight: { configurable: true, value: 50 },
                      });
                    },
                    () => [
                      <Select.Item value="one">One</Select.Item>,
                      <Select.Item value="two">Two</Select.Item>,
                    ],
                  )}
                />
                <Select.ScrollDownArrow keepMounted />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByRole('combobox'));

      const list = await screen.findByRole('listbox');
      await fireEvent.scroll(list);

      const upArrow = screen.getByText('▲');
      const downArrow = screen.getByText('▼');

      await waitFor(() => {
        expect(upArrow).toHaveAttribute('data-visible');
      });
      await waitFor(() => {
        expect(downArrow).toHaveAttribute('data-visible');
      });

      await user.click(screen.getByRole('combobox'));
      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
      actions.unmount();
      await flushMicrotasks();

      expect(upArrow).not.toHaveAttribute('data-visible');
      expect(downArrow).not.toHaveAttribute('data-visible');
    });

    it('does not leave a tabbable option while closed and kept mounted after tabbing out', async () => {
      const { user } = await render(
        <div>
          <input />
          <Select.Root
            defaultValue="1"
            modal={false}
            onOpenChange={(_open: boolean, details: OpenChangeDetails) =>
              details.preventUnmountOnClose()
            }
          >
            <Select.Trigger>Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">1</Select.Item>
                  <Select.Item value="2">2</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <input data-testid="after" />
        </div>,
      );

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      const option = await screen.findByRole('option', { name: '1' });
      option.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(option).toHaveFocus();
      });
      expect(option).toHaveAttribute('tabindex', '0');

      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
      expect(screen.getByRole('listbox')).not.toHaveAttribute('data-open');
      expect(option).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('scroll arrows', () => {
    it('normalizes overlapping fractional scroll ranges when toggling scroll arrow visibility', async () => {
      let scrollTop = 0.4;

      await render(
        <Select.Root open>
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List
                  v-slots={actOnElement(
                    'div',
                    (node) => {
                      Object.defineProperty(node, 'scrollTop', {
                        configurable: true,
                        get: () => scrollTop,
                        set: (value: number) => {
                          scrollTop = value;
                        },
                      });
                      Object.defineProperty(node, 'scrollHeight', {
                        value: 60.6,
                        configurable: true,
                      });
                      Object.defineProperty(node, 'clientHeight', {
                        value: 60,
                        configurable: true,
                      });
                    },
                    () => [
                      <Select.Item value="one">One</Select.Item>,
                      <Select.Item value="two">Two</Select.Item>,
                      <Select.Item value="three">Three</Select.Item>,
                    ],
                  )}
                />
                <Select.ScrollDownArrow keepMounted />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const list = screen.getByRole('listbox');
      const upArrow = screen.getByText('▲');
      const downArrow = screen.getByText('▼');

      await waitFor(() => {
        expect(upArrow).toHaveAttribute('data-visible');
      });
      expect(downArrow).not.toHaveAttribute('data-visible');

      scrollTop = 0.2;
      await fireEvent.scroll(list);

      // Both arrows are updated by the same scroll handler.
      await waitFor(() => {
        expect(downArrow).toHaveAttribute('data-visible');
      });
      expect(upArrow).not.toHaveAttribute('data-visible');
    });

    it.skipIf(isJSDOM)(
      'keeps a scroll arrow mounted while its exit animation runs',
      async ({ onTestFinished }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
        });

        let scrollTop = 0;

        const style = `
          @keyframes select-scroll-arrow-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-scroll-arrow[data-ending-style] {
            animation: select-scroll-arrow-close-test 100ms linear;
          }
        `;

        await render(
          <div>
            <style>{style}</style>
            <Select.Root open>
              <Select.Trigger>Open</Select.Trigger>
              <Select.Portal>
                <Select.Positioner alignItemWithTrigger={false}>
                  <Select.Popup>
                    <Select.List
                      v-slots={actOnElement(
                        'div',
                        (node) => {
                          Object.defineProperty(node, 'scrollTop', {
                            configurable: true,
                            get: () => scrollTop,
                            set: (value: number) => {
                              scrollTop = value;
                            },
                          });
                          Object.defineProperty(node, 'scrollHeight', {
                            value: 100,
                            configurable: true,
                          });
                          Object.defineProperty(node, 'clientHeight', {
                            value: 60,
                            configurable: true,
                          });
                        },
                        () => [
                          <Select.Item value="one">One</Select.Item>,
                          <Select.Item value="two">Two</Select.Item>,
                          <Select.Item value="three">Three</Select.Item>,
                        ],
                      )}
                    />
                    <Select.ScrollDownArrow
                      class="animation-test-scroll-arrow"
                      data-testid="scroll-arrow"
                    />
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );
        await flushMicrotasks();

        const list = screen.getByRole('listbox');

        await waitFor(() => {
          expect(screen.getByTestId('scroll-arrow')).toHaveAttribute('data-visible');
        });

        // The exit lasts 100 ms. The observer records that the arrow has `data-ending-style`, and
        // the record stays after the exit.
        const arrow = screen.getByTestId('scroll-arrow');
        let hasEndingStyle = false;
        const observer = new MutationObserver(() => {
          hasEndingStyle ||= arrow.hasAttribute('data-ending-style');
        });
        observer.observe(arrow, { attributeFilter: ['data-ending-style'] });
        onTestFinished(() => observer.disconnect());

        scrollTop = 40;
        await nextEvent(arrow, 'animationend', { action: () => fireEvent.scroll(list) });
        await flushMicrotasks();

        expect(hasEndingStyle).toBe(true);
        expect(screen.queryByTestId('scroll-arrow')).toBe(null);
      },
    );
  });

  hiddenInputTypeTests({
    render,
    createComponent: (props) => (
      <Select.Root {...props}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
      </Select.Root>
    ),
  });

  hiddenInputSizeTests({
    render,
    createComponent: (props) => (
      <Select.Root {...props}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
      </Select.Root>
    ),
  });

  describe('prop: readOnly', () => {
    it('sets the readOnly state', async () => {
      const { user } = await render(
        <Select.Root defaultValue="b" readOnly>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-readonly', 'true');
      expect(trigger).toHaveAttribute('data-readonly');

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();
    });

    it('does not commit a value with Enter on a highlighted item', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Select.Root onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      screen.getByTestId('trigger').focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');
      await screen.findByRole('listbox');
      await user.keyboard('{Enter}');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });

    it('does not commit a value with typeahead on a closed trigger', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Select.Root onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="apple">apple</Select.Item>
                <Select.Item value="banana">banana</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await focusTrigger(screen.getByTestId('trigger'));

      await user.keyboard('b');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });

    it.skipIf(isJSDOM)('moves the highlight with typeahead while the popup is open', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Select.Root defaultOpen onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="apple">apple</Select.Item>
                <Select.Item value="banana">banana</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const apple = await screen.findByRole('option', { name: 'apple' });
      const banana = screen.getByRole('option', { name: 'banana' });

      apple.focus();
      await flushMicrotasks();

      await user.keyboard('b');

      await waitFor(() => {
        expect(banana).toHaveAttribute('data-highlighted');
      });
      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });
  });

  describe('prop: id', () => {
    it('sets a hidden input id when name is not provided', async () => {
      const { container } = await render(
        <Select.Root id="test-id">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = container.querySelector('input');
      expect(hiddenInput).toHaveAttribute('id', 'test-id-hidden-input');
      expect(hiddenInput).not.toHaveAttribute('name');
    });

    it('does not set a hidden input id when name is provided', async () => {
      await render(
        <Select.Root id="test-id" name="country">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).not.toHaveAttribute('id');
    });
  });

  describe('with Field.Root parent', () => {
    it('applies the root id to the trigger', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Select.Root id="test-id">
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
          </Select.Root>
        </Field.Root>,
      );

      expect(screen.getByTestId('trigger')).toHaveAttribute('id', 'test-id');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'test-id');
    });
  });

  describe('Field', () => {
    describe('[data-focused] without a blur event', () => {
      function Selects(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <Field.Root data-testid="field">
            {firstMounted && (
              <Select.Root disabled={firstDisabled}>
                <Select.Trigger data-testid="first" />
              </Select.Root>
            )}
          </Field.Root>
        );
      }

      it('is removed when the focused trigger becomes disabled', async () => {
        const { setProps } = await render(<Selects />);

        const trigger = screen.getByTestId('first');
        trigger.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(trigger).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused trigger unmounts', async () => {
        const { setProps } = await render(<Selects />);

        screen.getByTestId('first').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });
    });

    it('marks the field as touched and validates it when an outside press closes the popup', async () => {
      const validate = vi.fn((_value: unknown) => 'Pick a font');
      const { user } = await render(
        <Field.Root data-testid="field" validate={validate} validationMode="onBlur">
          <Select.Root defaultOpen defaultValue="sans">
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('trigger')).not.toHaveFocus();

      await user.click(document.body);

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('sans');
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Pick a font');
      });
    });

    it('BUG-1425: makes a required select with no value invalid when an outside press closes the popup', async () => {
      const { user } = await render(
        <Field.Root data-testid="field" validationMode="onBlur">
          <Select.Root defaultOpen required>
            <StoreProbe />
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>,
      );
      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(document.body);

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-dirty');

      await setValueAsItem('sans');

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-invalid');
    });

    it('sets the filled and dirty state of the field from the value', async () => {
      await render(
        <Field.Root data-testid="field">
          <Select.Root>
            <StoreProbe />
            <Select.Trigger />
          </Select.Root>
        </Field.Root>,
      );
      const field = screen.getByTestId('field');
      expect(field).not.toHaveAttribute('data-filled');
      expect(field).not.toHaveAttribute('data-dirty');

      await setValueAsItem('sans');

      expect(field).toHaveAttribute('data-filled', '');
      expect(field).toHaveAttribute('data-dirty', '');

      await setValueAsItem(null);

      expect(field).not.toHaveAttribute('data-filled');
      expect(field).not.toHaveAttribute('data-dirty');
    });

    it('gives its value to the form', async () => {
      const handleFormSubmit = vi.fn();
      await render(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="font">
            <Select.Root defaultValue={{ code: 'sans' }} itemToStringValue={(item) => item.code}>
              <Select.Trigger />
            </Select.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleFormSubmit).toHaveBeenCalledTimes(1);
      expect(handleFormSubmit.mock.lastCall?.[0]).toEqual({ font: 'sans' });
    });
  });

  describe('typeahead', () => {
    it('matches an item by its label when the rendered text differs', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="us" label="United States">
                  <Select.ItemText>Option 1</Select.ItemText>
                </Select.Item>
                <Select.Item value="fr" label="France">
                  <Select.ItemText>Option 2</Select.ItemText>
                </Select.Item>
                <Select.Item value="ca" label="Canada">
                  <Select.ItemText>Option 3</Select.ItemText>
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      screen.getByTestId('trigger').focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Option 1' })).toHaveFocus();
      });

      // Only the label matches; the rendered text is "Option 2".
      await user.keyboard('fr');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Option 2' })).toHaveFocus();
      });
    });

    it('starts a new search after focus leaves the select', async () => {
      const { user } = await render(
        <div>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="banana">banana</Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button data-testid="outside">outside</button>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');
      await focusTrigger(trigger);
      await user.keyboard('b');
      expect(screen.getByTestId('value').textContent).toBe('banana');

      // Leaving and returning within the typeahead timeout must not continue the "b" search.
      screen.getByTestId('outside').focus();
      await focusTrigger(trigger);
      await user.keyboard('a');

      expect(screen.getByTestId('value').textContent).toBe('avocado');
    });

    it.skipIf(isJSDOM)(
      'does not trigger selection when Space is pressed during text navigation',
      async () => {
        const handleItemClick = vi.fn();
        const handleValueChange = vi.fn();

        const { user } = await render(
          <Select.Root defaultOpen onValueChange={handleValueChange}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="one" onClick={() => handleItemClick()}>
                    Item One
                  </Select.Item>
                  <Select.Item value="two" onClick={() => handleItemClick()}>
                    Item Two
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );
        await flushMicrotasks();

        const options = screen.getAllByRole('option');

        options[0]!.focus();
        await flushMicrotasks();

        await user.keyboard('Item T');

        expect(handleItemClick.mock.calls.length > 0).toBe(false);
        expect(handleValueChange.mock.calls.length > 0).toBe(false);

        await waitFor(() => {
          expect(options[1]).toHaveFocus();
        });
      },
    );

    it('skips disabled items and commits the next match via typeahead on a closed trigger', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apricot" disabled>
                    apricot
                  </Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "apricot" and "avocado" both start with "a", but "apricot" is disabled. A single "a"
      // keypress must skip the disabled "apricot" and land on "avocado" — like native `<select>`
      // and arrow-key navigation — not stop on (or bail at) the disabled match.
      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('avocado');
    });

    it('commits typeahead on a closed trigger when items are provided', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            items={{ apple: 'Apple', cherry: 'Cherry' }}
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">Apple</Select.Item>
                  <Select.Item value="cherry">Cherry</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // The popup is never opened. With `items` provided the value-change effect no longer
      // force-mounts, so this pins the load-bearing claim that the trigger's own onFocus
      // force-mount still registers the list for closed-trigger typeahead.
      await focusTrigger(trigger);
      await user.keyboard('c');
      expect(valueEl.textContent).toBe('Cherry');
    });

    it('commits nothing when the only typeahead match is disabled (closed trigger)', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="cherry">cherry</Select.Item>
                  <Select.Item value="banana" disabled>
                    banana
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "banana" is the only "b" item and it's disabled, so there is no selectable match.
      await focusTrigger(trigger);
      await user.keyboard('b');
      expect(valueEl.textContent).toBe('');
    });

    it('does not let a disabled double-letter item block rapid cycling among enabled matches', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <Select.Root
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="aaron" disabled>
                    aaron
                  </Select.Item>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // The disabled "aaron" has a doubled first letter, which would otherwise disable
      // rapid same-letter cycling. Because disabled items are skipped while matching, they
      // must not count toward that guard: pressing "a" twice should cycle apple -> avocado.
      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('apple');
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('avocado');
    });

    it.skipIf(isJSDOM)(
      'skips disabled items when highlighting via typeahead on an open popup',
      async () => {
        const { user } = await render(
          <Select.Root defaultOpen>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apricot" disabled>
                    apricot
                  </Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const apricot = await screen.findByRole('option', { name: 'apricot' });
        const avocado = screen.getByRole('option', { name: 'avocado' });

        avocado.focus();
        await flushMicrotasks();

        // Open-state typeahead highlights via `activeIndex` (the closed branch commits the value
        // instead). Typing "a" must skip the disabled "apricot" and highlight "avocado".
        await user.keyboard('a');

        await waitFor(() => {
          expect(avocado).toHaveAttribute('data-highlighted');
        });
        expect(apricot).not.toHaveAttribute('data-highlighted');
      },
    );

    it('starts from the first match after value reset (closed)', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        return () => (
          <>
            <button
              data-testid="reset"
              onClick={() => {
                value.value = null;
              }}
            >
              Reset
            </button>
            <Select.Root
              value={value.value}
              onValueChange={(next: string | null) => {
                value.value = next;
              }}
            >
              <Select.Trigger data-testid="trigger">
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a1">A1</Select.Item>
                    <Select.Item value="a2">A2</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const resetBtn = screen.getByTestId('reset');

      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('a1');

      await user.click(resetBtn);

      await focusTrigger(trigger);
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('a1');
    });

    it('does not jump matches after a closed-state value reset', async () => {
      const App = defineComponent(() => {
        const value = shallowRef<string | null>('dog');
        return () => (
          <>
            <button
              data-testid="set-car"
              onClick={() => {
                value.value = 'car';
              }}
            >
              Set car
            </button>
            <Select.Root
              value={value.value}
              onValueChange={(next: string | null) => {
                value.value = next;
              }}
            >
              <Select.Trigger data-testid="trigger">
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="car">car</Select.Item>
                    <Select.Item value="cat">cat</Select.Item>
                    <Select.Item value="dog">dog</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const setCarButton = screen.getByTestId('set-car');

      expect(valueEl.textContent).toBe('dog');

      await user.click(setCarButton);
      expect(valueEl.textContent).toBe('car');

      await focusTrigger(trigger);
      await user.keyboard('c');
      expect(valueEl.textContent).toBe('cat');

      await user.keyboard('a');
      expect(valueEl.textContent).toBe('cat');
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it.skipIf(isWebKit)('highlights an item on mouse move by default', async () => {
      const { user } = await render(
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await flushMicrotasks();
      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it.skipIf(isJSDOM)(
      'highlights the first item after opening when alignItemWithTrigger is active and no value is selected',
      async () => {
        await render(
          <div style={{ paddingTop: '120px', paddingLeft: '24px' }}>
            <Select.Root>
              <Select.Trigger data-testid="trigger" style={{ width: '120px', height: '36px' }}>
                <Select.Value placeholder="Pick one" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup style={{ maxHeight: 'none' }}>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                    <Select.Item value="c">c</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        await fireEvent.mouseDown(trigger);

        const optionA = await screen.findByRole('option', { name: 'a' });

        await waitFor(() => {
          expect(optionA).toHaveAttribute('data-highlighted');
        });
      },
    );

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await flushMicrotasks();
      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await flushMicrotasks();

      expect(optionB).not.toHaveAttribute('data-highlighted');
    });

    it('does not remove highlight when mousing out of popup when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await flushMicrotasks();
      const optionA = screen.getByRole('option', { name: 'a' });
      await user.hover(optionA);

      const popup = screen.getByRole('listbox');
      await waitFor(() => {
        expect(popup).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      await user.unhover(popup);

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });
    });
  });

  describe('prop: multiple', () => {
    it('removes selections that no longer exist', async () => {
      const Test = defineComponent(() => {
        const items = shallowRef(['a', 'b', 'c']);
        return () => (
          <div>
            <Select.Root multiple defaultValue={['a', 'c']}>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.value.map((item) => (
                      <Select.Item key={item} value={item}>
                        {item}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="remove-a"
              onClick={() => {
                items.value = items.value.filter((item) => item !== 'a');
              }}
            >
              Remove A
            </button>
            <button
              data-testid="remove-c"
              onClick={() => {
                items.value = items.value.filter((item) => item !== 'c');
              }}
            >
              Remove C
            </button>
          </div>
        );
      });

      const { user } = await render(<Test />);

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      });
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');

      // Remove one of the selected items; remaining selection should persist
      await user.click(screen.getByTestId('remove-c'));

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      });
      expect(screen.queryByRole('option', { name: 'c' })).toBe(null);

      // Remove the last selected item; selection should become empty
      await user.click(screen.getByTestId('remove-a'));

      await user.click(trigger);

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });

    it('removes selections replaced without changing the item count', async () => {
      const onValueChange = vi.fn();

      const Test = defineComponent(() => {
        const items = shallowRef(['a', 'b', 'c']);
        const value = shallowRef(['a', 'c']);

        return () => (
          <div>
            <Select.Root
              multiple
              defaultOpen
              value={value.value}
              onValueChange={(nextValue: unknown) => {
                value.value = nextValue as string[];
                onValueChange(nextValue);
              }}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.value.map((item) => (
                      <Select.Item key={item} value={item}>
                        {item}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              onClick={() => {
                items.value = ['a', 'b', 'd'];
              }}
            >
              Replace C with D
            </button>
          </div>
        );
      });

      await render(<Test />);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');

      await fireEvent.click(screen.getByRole('button', { name: 'Replace C with D' }));

      await waitFor(() => {
        expect(onValueChange.mock.lastCall?.[0]).toEqual(['a']);
      });
      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'd' })).not.toHaveAttribute('data-selected');
    });

    it('should allow multiple selections when multiple is true', async () => {
      const handleValueChange = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<any[]>([]);

        return () => (
          <Select.Root
            multiple
            value={value.value}
            onValueChange={(newValue: unknown) => {
              value.value = newValue as any[];
              handleValueChange(newValue);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);
      expect(optionA).toHaveAttribute('data-selected', '');

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.click(optionB);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b']);
      expect(optionA).toHaveAttribute('data-selected', '');
      expect(optionB).toHaveAttribute('data-selected', '');

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('keeps the selection when items are added and none of the selected ones are removed', async () => {
      const handleValueChange = vi.fn();

      const App = defineComponent(() => {
        const items = shallowRef(['a', 'b']);

        return () => (
          <div>
            <Select.Root multiple open defaultValue={['a']} onValueChange={handleValueChange}>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.value.map((item) => (
                      <Select.Item key={item} value={item}>
                        {item}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="add"
              onClick={() => {
                items.value = [...items.value, 'c'];
              }}
            >
              Add C
            </button>
          </div>
        );
      });

      const { user } = await render(<App />);

      expect(await screen.findByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');

      await user.click(screen.getByTestId('add'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
      });

      // Growing the list must not rewrite a still-valid selection.
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
    });

    it('should deselect items when clicked again in multiple mode', async () => {
      const handleValueChange = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef(['a', 'b']);

        return () => (
          <Select.Root
            multiple
            value={value.value}
            onValueChange={(newValue: unknown) => {
              value.value = newValue as string[];
              handleValueChange(newValue);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const optionA = await screen.findByRole('option', { name: 'a' });
      const optionB = screen.getByRole('option', { name: 'b' });

      expect(optionA).toHaveAttribute('data-selected', '');
      expect(optionB).toHaveAttribute('data-selected', '');

      await user.click(optionA);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[0][0]).toEqual(['b']);
      expect(optionA).not.toHaveAttribute('data-selected');
      expect(optionB).toHaveAttribute('data-selected', '');
    });

    it('should update selected items when the controlled value prop changes while open', async () => {
      const { setProps } = await render(
        <Select.Root multiple value={['a', 'b']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');

      await setProps({ value: ['b'] });

      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'a' })).not.toHaveAttribute('data-selected');
    });

    it('keeps the active index on a deselected item in multiple mode', async () => {
      const { user } = await render(
        <Select.Root multiple value={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      const optionB = await screen.findByRole('option', { name: 'b' });

      await user.click(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });

      await user.click(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it('highlights the first selected item in rendered order regardless of value order', async () => {
      // `a` renders first but sits in the middle of the value array, so neither end of that
      // array points at it and only the rendered order does.
      const { user } = await render(
        <Select.Root multiple defaultValue={['b', 'a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));

      const optionA = await screen.findByRole('option', { name: 'a' });
      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-highlighted');
      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });

    it('re-elects the anchor when the anchor item value changes in place', async () => {
      const App = (props: { replaceA?: boolean }) => (
        <Select.Root multiple defaultValue={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={props.replaceA ? 'x' : 'a'}>
                  {props.replaceA ? 'x' : 'a'}
                </Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );

      const { user, setProps } = await render(<App />);

      // The list only mounts on the first open, and stays mounted once closed. Opening
      // first is what makes the swap below happen in place, on items that already
      // registered their values and elected an anchor.
      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      await screen.findByRole('option', { name: 'a' });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ replaceA: true });

      await user.click(trigger);

      const optionC = await screen.findByRole('option', { name: 'c' });
      await waitFor(() => {
        expect(optionC).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'x' })).not.toHaveAttribute('data-highlighted');
    });

    it('moves the anchor to the next selected item when the anchor item leaves the list', async () => {
      const App = (props: { trimmed?: boolean }) => (
        <Select.Root multiple defaultValue={['a', 'b', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {!props.trimmed && <Select.Item value="a">a</Select.Item>}
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );

      const { user, setProps } = await render(<App />);

      // The items have to register under the full list before one of them can leave it.
      await user.click(screen.getByTestId('trigger'));
      await screen.findByRole('option', { name: 'a' });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ trimmed: true });

      await user.click(screen.getByTestId('trigger'));

      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });

    it('re-anchors backwards when a new isItemEqualToValue identity re-runs every item', async () => {
      // An inline comparer gives every render a new identity, so all item effects re-run. The
      // anchor moving to an earlier item must survive the old anchor's own effect.
      interface Option {
        id: number;
      }
      const options: Option[] = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];

      const App = (props: { value: Option[] }) => (
        <Select.Root
          multiple
          value={props.value}
          isItemEqualToValue={(a: Option, b: Option) => a.id === b.id}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value v-slots={{ default: () => 'value' }} />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {options.map((option) => (
                  <Select.Item key={option.id} value={option}>
                    <Select.ItemText>{`opt-${option.id}`}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );

      const { user, setProps } = await render(<App value={[{ id: 2 }, { id: 3 }]} />);

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'opt-2' })).toHaveAttribute('data-highlighted');
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ value: [{ id: 0 }, { id: 1 }] });

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'opt-0' })).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'opt-1' })).not.toHaveAttribute('data-highlighted');
    });

    it.skipIf(isJSDOM)(
      'aligns the first selected item with the trigger when alignItemWithTrigger is active',
      async () => {
        // The list has to be long enough, and the popup unconstrained enough, for aligned
        // positioning to stay active. Otherwise the popup falls back to a side and the
        // measurement below would be meaningless, so `data-side` is asserted first.
        const options = Array.from({ length: 40 }, (_, index) => `opt-${index}`);

        const { user } = await render(
          <div style={{ paddingTop: '120px', paddingLeft: '32px' }}>
            <Select.Root multiple defaultValue={['opt-10', 'opt-30']}>
              <Select.Trigger data-testid="trigger" style={{ width: '160px', height: '36px' }}>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup
                    data-testid="popup"
                    style={{ maxHeight: 'none', minHeight: '100px' }}
                  >
                    {options.map((option) => (
                      <Select.Item key={option} value={option}>
                        <Select.ItemText>{option}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        const anchorItem = await screen.findByRole('option', { name: 'opt-10' });
        await waitFor(() => {
          expect(anchorItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-side', 'none');
        });

        const verticalCenter = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return rect.top + rect.height / 2;
        };

        await waitFor(() => {
          expect(
            Math.abs(verticalCenter(anchorItem) - verticalCenter(trigger)),
          ).toBeLessThanOrEqual(1);
        });
      },
    );

    it('anchors to the first selected item when opened with the keyboard', async () => {
      const { user } = await render(
        <Select.Root multiple defaultValue={['b', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.keyboard('{Tab}');
      expect(screen.getByTestId('trigger')).toHaveFocus();
      await user.keyboard('{ArrowDown}');

      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });

    it('continues arrow navigation from the anchor rather than the top of the list', async () => {
      const { user } = await render(
        <Select.Root multiple defaultValue={['b', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
                <Select.Item value="d">d</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      // Focus reaches the anchor asynchronously. Keys sent before it lands are lost.
      await waitFor(() => {
        expect(optionB).toHaveFocus();
      });

      // The next item after the anchor, not `a` at the top.
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it('keeps the highlight on an item deselected with the keyboard', async () => {
      const { user } = await render(
        <Select.Root multiple defaultValue={['b', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      // Focus reaches the anchor asynchronously. Keys sent before it lands are lost.
      await waitFor(() => {
        expect(optionB).toHaveFocus();
      });

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(optionB).toHaveAttribute('aria-selected', 'false');
      });
      expect(optionB).toHaveAttribute('data-highlighted');
    });

    it('anchors to the first selected item in rendered order across groups', async () => {
      // `spinach` renders first but is not the last value, so anchoring to the rendered order
      // and anchoring to the end of the value array give different answers.
      const { user } = await render(
        <Select.Root multiple defaultValue={['spinach', 'plum']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Group>
                  <Select.GroupLabel>Vegetables</Select.GroupLabel>
                  <Select.Item value="artichoke">artichoke</Select.Item>
                  <Select.Item value="spinach">spinach</Select.Item>
                </Select.Group>
                <Select.Group>
                  <Select.GroupLabel>Fruits</Select.GroupLabel>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="plum">plum</Select.Item>
                </Select.Group>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));

      const spinachItem = await screen.findByRole('option', { name: 'spinach' });
      await waitFor(() => {
        expect(spinachItem).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'plum' })).not.toHaveAttribute('data-highlighted');
    });

    it.skipIf(isJSDOM)(
      'scrolls the first selected item into view on open',
      async ({ onTestFinished }) => {
        const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
        onTestFinished(() => scrollIntoView.mockRestore());
        const options = Array.from({ length: 100 }, (_, index) => `item ${index}`);

        const { user } = await render(
          <Select.Root multiple defaultValue={['item 80', 'item 90']}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              {/* Aligned positioning translates the popup instead of scrolling the list, so the
                  scroll path only runs with it turned off. */}
              <Select.Positioner alignItemWithTrigger={false}>
                <Select.Popup style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {options.map((option) => (
                    <Select.Item key={option} value={option}>
                      <Select.ItemText>{option}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        scrollIntoView.mockClear();
        await user.click(screen.getByTestId('trigger'));

        const selectedItem = await screen.findByRole('option', { name: 'item 80' });
        await waitFor(() => {
          expect(selectedItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(scrollIntoView.mock.contexts).toContain(selectedItem);
        });
      },
    );

    it('should handle defaultValue as array in multiple mode', async () => {
      await render(
        <Select.Root multiple defaultValue={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');
    });

    it('should serialize multiple values correctly for form submission', async () => {
      const { container } = await render(
        <Select.Root multiple name="select" value={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const hiddenInputs = container.querySelectorAll<HTMLInputElement>('[name="select"]');
      expect(hiddenInputs).toHaveLength(2);
      const values = Array.from(hiddenInputs).map((input) => input.value);
      expect(values).toEqual(['a', 'c']);
    });

    it.skipIf(isJSDOM)('does not submit multiple values when disabled', async () => {
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.getAll('select');
      });

      const { user } = await render(
        <form onSubmit={submitSpy}>
          <Select.Root multiple disabled name="select" value={['a', 'c']}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toEqual([]);
    });

    it('should serialize empty array as empty string in multiple mode', async () => {
      const { container } = await render(
        <Select.Root multiple name="select">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // In multiple mode with empty array, no hidden inputs with name should exist
      const namedHiddenInputs = container.querySelectorAll('[name="select"]');
      expect(namedHiddenInputs).toHaveLength(0);

      // But the main input should have the serialized empty value for Field validation purposes
      const mainInput = container.querySelector<HTMLInputElement>('input[aria-hidden="true"]');
      expect(mainInput).not.toBe(null);
      expect(mainInput?.value).toBe('');
    });

    it('does not mark the hidden input as required when selection exists', async () => {
      await render(
        <Select.Root multiple required name="select" value={['a']}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists', async () => {
      await render(
        <Select.Root multiple required name="select" value={[]}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).toHaveAttribute('required');
    });

    it('should not close popup when selecting items in multiple mode', async () => {
      const { user } = await render(
        <Select.Root multiple>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).not.toBe(null);

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.click(optionB);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('should close popup in single select mode', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('should update selected items when value prop changes', async () => {
      const { setProps } = await render(
        <Select.Root multiple value={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(await screen.findByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');

      await setProps({ value: ['a', 'b', 'c'] });

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');
    });
  });

  describe('prop: isItemEqualToValue', () => {
    it('matches object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Select.Root
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {users.map((user) => (
                  <Select.Item key={user.id} value={user}>
                    {user.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('Bob');

      await fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('data-selected', '');
      });
    });

    it('matches object values when the popup is mounted on the initial render', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Select.Root
          defaultOpen
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {users.map((user) => (
                  <Select.Item key={user.id} value={user}>
                    {user.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'Alice' })).not.toHaveAttribute('data-selected');
    });

    it('passes item as the first comparator argument in multiple mode', async () => {
      const users = [
        { id: 1, name: 'Alice', source: 'item' },
        { id: 2, name: 'Bob', source: 'item' },
      ];

      await render(
        <Select.Root
          multiple
          defaultOpen
          defaultValue={[{ id: 2, name: 'Bob', source: 'selected' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) =>
            item.id === value.id && item.source === 'item' && value.source === 'selected'
          }
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {users.map((user) => (
                  <Select.Item key={user.id} value={user}>
                    {user.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'Bob' });
      expect(option).toHaveAttribute('data-selected', '');

      await fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).not.toHaveAttribute('data-selected');
      });
    });
  });

  describe('groups', () => {
    it('navigates across groups without stopping on labels or separators', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Group>
                  <Select.GroupLabel>Fruits</Select.GroupLabel>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="banana">banana</Select.Item>
                </Select.Group>
                <Select.Separator />
                <Select.Group>
                  <Select.GroupLabel>Vegetables</Select.GroupLabel>
                  <Select.Item value="carrot">carrot</Select.Item>
                  <Select.Item value="leek">leek</Select.Item>
                </Select.Group>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await focusTrigger(screen.getByTestId('trigger'));
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'apple' })).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'carrot' })).toHaveFocus();
      });

      await user.keyboard('{End}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'leek' })).toHaveFocus();
      });

      await user.keyboard('{Home}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'apple' })).toHaveFocus();
      });
    });
  });

  describe.skipIf(isJSDOM)('item-aligned popup interaction', () => {
    const items = Array.from({ length: 30 }, (_, index) => `Item ${index}`);

    const AlignedSelect = () => (
      <div style={{ paddingTop: '240px' }}>
        <Select.Root defaultValue="Item 15">
          <Select.Trigger data-testid="trigger" style={{ height: '30px' }}>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup data-testid="popup" style={{ maxHeight: '200px' }}>
                {items.map((item) => (
                  <Select.Item key={item} value={item} style={{ height: '30px' }}>
                    {item}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
    );

    async function settleFrames() {
      await waitSingleFrame();
      await waitSingleFrame();
    }

    function getPopupGeometry() {
      const popup = screen.getByTestId('popup');
      const rect = popup.getBoundingClientRect();
      return { top: rect.top, height: rect.height, scrollTop: popup.scrollTop };
    }

    it('does not move the popup or its list when hovering items at its edges', async () => {
      const { user } = await render(<AlignedSelect />);
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Item 15' })).toHaveFocus();
      });
      await settleFrames();
      const before = getPopupGeometry();
      const popupRect = screen.getByTestId('popup').getBoundingClientRect();
      const options = screen.getAllByRole('option');
      const topEdgeItem = options.find((option) => {
        return option.getBoundingClientRect().bottom > popupRect.top;
      })!;
      const bottomEdgeItem = options
        .filter((option) => {
          return option.getBoundingClientRect().top < popupRect.bottom;
        })
        .at(-1)!;

      for (const item of [bottomEdgeItem, topEdgeItem]) {
        await user.hover(item);
        await waitFor(() => {
          expect(item).toHaveAttribute('data-highlighted');
        });
        await settleFrames();
        expect(getPopupGeometry()).toEqual(before);
      }
    });

    it('keeps the highlighted item visible while keyboard navigation grows the popup', async () => {
      // An early selected item near the bottom of the viewport opens the popup short, so
      // navigating down has to grow it toward its max height.
      const { user } = await render(
        <div style={{ position: 'fixed', left: '20px', bottom: '160px' }}>
          <Select.Root defaultValue="Item 1">
            <Select.Trigger data-testid="trigger" style={{ height: '30px' }}>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup data-testid="popup" style={{ maxHeight: '400px' }}>
                  {items.map((item) => (
                    <Select.Item key={item} value={item} style={{ height: '30px' }}>
                      <Select.ItemText>{item}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>,
      );
      await focusTrigger(screen.getByTestId('trigger'));
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Item 1' })).toHaveFocus();
      });
      await settleFrames();
      const positioner = screen.getByTestId('positioner');
      const initialHeight = positioner.getBoundingClientRect().height;

      function isInsidePopup(name: string) {
        const popupRect = screen.getByTestId('popup').getBoundingClientRect();
        const itemRect = screen.getByRole('option', { name }).getBoundingClientRect();
        return itemRect.top >= popupRect.top - 1 && itemRect.bottom <= popupRect.bottom + 1;
      }

      async function navigate(from: number, to: number) {
        await user.keyboard('{ArrowDown}'.repeat(to - from));
        await waitFor(() => {
          expect(screen.getByRole('option', { name: `Item ${to}` })).toHaveFocus();
        });
        await settleFrames();
      }

      // While there is room to grow, the popup grows instead of scrolling its first items away.
      await navigate(1, 9);
      expect(positioner.getBoundingClientRect().height).toBeGreaterThan(initialHeight);
      expect(isInsidePopup('Item 0')).toBe(true);
      expect(isInsidePopup('Item 9')).toBe(true);

      await navigate(9, 25);
      expect(positioner.getBoundingClientRect().height).toBeGreaterThan(initialHeight + 100);
      expect(isInsidePopup('Item 25')).toBe(true);
    });
  });

  describe('opening', () => {
    it('does not carry an ArrowUp opening over to a later pointer opening', async () => {
      // A selected item claims the keyboard opening, so the ArrowUp is never consumed.
      const Test = defineComponent(() => {
        const value = shallowRef<string | null>('b');

        return () => (
          <div>
            <button
              data-testid="clear"
              onClick={() => {
                value.value = null;
              }}
            >
              Clear
            </button>
            <Select.Root
              value={value.value}
              onValueChange={(nextValue: unknown) => {
                value.value = nextValue as string | null;
              }}
            >
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner alignItemWithTrigger={false}>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                    <Select.Item value="c">c</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);
      const trigger = screen.getByTestId('trigger');
      await focusTrigger(trigger);
      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveFocus();
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });

      await user.click(screen.getByTestId('clear'));
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toHaveFocus();
      });
      await wait(50);

      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('closing', () => {
    it('reports a close after the parent declined an open without canceling it', async () => {
      const handleOpenChange = vi.fn();
      let actions!: Select.Root.Actions;

      const App = defineComponent(() => {
        const open = shallowRef(false);

        return () => (
          <Select.Root
            ref={(instance: unknown) => {
              if (instance) {
                actions = instance as Select.Root.Actions;
              }
            }}
            open={open.value}
            onOpenChange={(nextOpen: boolean, eventDetails: OpenChangeDetails) => {
              handleOpenChange(nextOpen, eventDetails.reason);
              if (!nextOpen) {
                open.value = false;
              }
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenLastCalledWith(true, REASONS.triggerPress);
      });
      expect(screen.queryByRole('listbox')).toBe(null);

      actions.close();
      await flushMicrotasks();

      // The store can't tell a declined open from one the parent applies later, so the close is
      // reported.
      expect(handleOpenChange).toHaveBeenLastCalledWith(false, REASONS.imperativeAction);
    });

    it('does not report a close after the parent canceled an open', async () => {
      const handleOpenChange = vi.fn();
      let actions!: Select.Root.Actions;

      const App = defineComponent(() => {
        const open = shallowRef(false);

        return () => (
          <Select.Root
            ref={(instance: unknown) => {
              if (instance) {
                actions = instance as Select.Root.Actions;
              }
            }}
            open={open.value}
            onOpenChange={(nextOpen: boolean, eventDetails: OpenChangeDetails) => {
              handleOpenChange(nextOpen, eventDetails.reason);
              if (nextOpen) {
                eventDetails.cancel();
              } else {
                open.value = false;
              }
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      });

      const { user } = await render(<App />);
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenLastCalledWith(true, REASONS.triggerPress);
      });

      actions.close();
      await flushMicrotasks();

      expect(handleOpenChange.mock.calls).toEqual([[true, REASONS.triggerPress]]);
    });

    it('does not notify the interactions of a close that onOpenChange cancels', async () => {
      const onOpenChange = vi.fn((open: boolean, eventDetails: ChangeDetails) => {
        if (!open) {
          eventDetails.cancel();
        }
      });
      const handleInteractionOpenChange = vi.fn();

      const InteractionOpenChangeListener = defineComponent(() => {
        const selectStore = useSelectRootContext();
        onMounted(() => {
          selectStore.context.events.on('openchange', handleInteractionOpenChange);
        });
        onBeforeUnmount(() => {
          selectStore.context.events.off('openchange', handleInteractionOpenChange);
        });
        return () => null;
      });

      const { user } = await render(
        <Select.Root defaultOpen onOpenChange={onOpenChange}>
          <InteractionOpenChangeListener />
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(await screen.findByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');

      expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(handleInteractionOpenChange).not.toHaveBeenCalled();
    });

    it.skipIf(isJSDOM)(
      'keeps the highlight on the item while the popup animates out',
      async ({ onTestFinished }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        onTestFinished(() => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
        });

        const { user } = await render(
          <div>
            <style>
              {`@keyframes select-test-exit { to { opacity: 0; } }
              .select-test-exit[data-ending-style] { animation: select-test-exit 10s; }`}
            </style>
            <Select.Root>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner alignItemWithTrigger={false}>
                  <Select.Popup class="select-test-exit" data-testid="popup">
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        await focusTrigger(screen.getByTestId('trigger'));
        await user.keyboard('{ArrowDown}');
        const optionA = await screen.findByRole('option', { name: 'a' });
        const optionB = screen.getByRole('option', { name: 'b' });
        await waitFor(() => {
          expect(optionA).toHaveFocus();
        });
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(optionB).toHaveFocus();
        });

        await user.keyboard('{Escape}');

        await waitFor(() => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
        });
        expect(optionB).toHaveAttribute('data-highlighted');

        // Items moving under the pointer while the popup fades out don't take the highlight.
        await fireEvent.mouseMove(optionA, {
          movementX: 1,
          movementY: 1,
        });
        expect(optionB).toHaveAttribute('data-highlighted');
      },
    );
  });

  describe('trigger render cost', () => {
    it('does not re-render the trigger while navigating the list', async () => {
      let triggerRenders = 0;

      const { user } = await render(
        <Select.Root>
          <Select.Trigger
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => {
                triggerRenders += 1;
                return (
                  <button type="button" {...props}>
                    <Select.Value />
                  </button>
                );
              },
            }}
          />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {Array.from({ length: 10 }, (_, index) => (
                  <Select.Item key={index} value={String(index)}>{`Item ${index}`}</Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByRole('combobox'));
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      await flushMicrotasks();

      triggerRenders = 0;
      await user.keyboard('[ArrowDown][ArrowDown][ArrowDown]');
      await flushMicrotasks();

      // See the matching assertion in MenuRoot.test.tsx: the shared list-navigation hook must not
      // rebuild trigger props when the highlight moves.
      expect(triggerRenders).toBe(0);
    });
  });

  describe('value', () => {
    it('emits valueChange and then update:value for a change that no listener cancels', async () => {
      const events: unknown[][] = [];
      await render(
        <Select.Root
          defaultValue="sans"
          onValueChange={(value: unknown, details: ChangeDetails) =>
            events.push(['valueChange', value, details.reason])
          }
          {...{ 'onUpdate:value': (value: unknown) => events.push(['update:value', value]) }}
        >
          <StoreProbe />
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      expect(await setValueAsItem('serif')).toBe(true);

      expect(events).toEqual([
        ['valueChange', 'serif', 'item-press'],
        ['update:value', 'serif'],
      ]);
      expect(screen.getByTestId('value')).toHaveTextContent('serif');
    });

    it('keeps the value when the listener cancels the change', async () => {
      const handleUpdate = vi.fn();
      await render(
        <Select.Root
          defaultValue="sans"
          onValueChange={(_value: unknown, details: ChangeDetails) => details.cancel()}
          {...{ 'onUpdate:value': handleUpdate }}
        >
          <StoreProbe />
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      expect(await setValueAsItem('serif')).toBe(false);

      expect(handleUpdate).toHaveBeenCalledTimes(0);
      expect(screen.getByTestId('value')).toHaveTextContent('sans');
    });

    it('follows the value prop of a controlled root', async () => {
      const value = shallowRef('sans');
      await render(() => (
        <Select.Root value={value.value}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>
      ));

      value.value = 'serif';
      await flushMicrotasks();

      expect(screen.getByTestId('value')).toHaveTextContent('serif');
      expect(getHiddenInput()).toHaveValue('serif');
    });
  });

  describe('open state', () => {
    it('emits openChange with the reason, then update:open', async () => {
      const events: unknown[][] = [];
      const { user } = await render(
        <Select.Root
          onOpenChange={(open: boolean, details: OpenChangeDetails) =>
            events.push(['openChange', open, details.reason])
          }
          {...{ 'onUpdate:open': (open: boolean) => events.push(['update:open', open]) }}
        >
          <Select.Trigger data-testid="trigger" />
        </Select.Root>,
      );
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      expect(events).toEqual([
        ['openChange', true, 'trigger-press'],
        ['update:open', true],
      ]);

      events.length = 0;
      await user.keyboard('[Escape]');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(events).toEqual([
        ['openChange', false, 'escape-key'],
        ['update:open', false],
      ]);
    });

    it('keeps the popup closed when the listener cancels the change', async () => {
      const handleUpdate = vi.fn();
      const handleOpenChange = vi.fn((_open: boolean, details: OpenChangeDetails) =>
        details.cancel(),
      );
      const { user } = await render(
        <Select.Root onOpenChange={handleOpenChange} {...{ 'onUpdate:open': handleUpdate }}>
          <Select.Trigger data-testid="trigger" />
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      expect(handleUpdate).toHaveBeenCalledTimes(0);
    });

    it('does not open while disabled', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Select.Root disabled onOpenChange={handleOpenChange}>
          <Select.Trigger data-testid="trigger" nativeButton={false} as="div" />
        </Select.Root>,
      );
      const trigger = screen.getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });
      await wait(20);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(handleOpenChange).toHaveBeenCalledTimes(0);
    });
  });

  describe('hidden inputs', () => {
    it('submits the value with the name of the root', async () => {
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue="serif">
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      expect(getFormData('font')).toEqual(['serif']);
    });

    it('submits one entry for each value of a multiple select, from inputs of its own', async () => {
      await render(
        <form data-testid="form">
          <Select.Root multiple name="tags" required defaultValue={['b']}>
            <StoreProbe />
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      expect(getFormData('tags')).toEqual(['b']);

      await setValueAsItem(['b', 'c']);

      expect(getFormData('tags')).toEqual(['b', 'c']);
      const inputs = document.querySelectorAll('input');
      expect(inputs).toHaveLength(3);
      expect(inputs[0]).not.toHaveAttribute('name');
      expect(inputs[0]).not.toHaveAttribute('required');
      expect(inputs[1]).toHaveAttribute('type', 'hidden');
    });

    it('does not submit the value of a disabled select', async () => {
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue="serif" disabled>
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      expect(getFormData('font')).toEqual([]);
    });

    it.each([
      { name: 'an input event', type: 'input' },
      { name: 'a change event', type: 'change' },
    ])('keeps its value after $name that gives the input another value', async ({ type }) => {
      const handleValueChange = vi.fn();
      await render(
        <Select.Root name="font" defaultValue="serif" onValueChange={handleValueChange}>
          <Select.Trigger />
        </Select.Root>,
      );
      const input = getHiddenInput();

      input.value = 'mono';
      await fireEvent[type === 'input' ? 'input' : 'change'](input);
      await flushMicrotasks();

      expect(input.value).toBe('serif');
      expect(handleValueChange).toHaveBeenCalledTimes(0);
    });

    it('writes its value to the input after a `pageshow` event', async () => {
      await render(
        <Select.Root name="font" defaultValue="serif">
          <Select.Trigger />
        </Select.Root>,
      );
      const input = getHiddenInput();
      input.value = 'mono';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));

      expect(input.value).toBe('serif');
    });
  });

  describe('autofill', () => {
    it('selects the item whose text the browser fills into the input of a closed select', async () => {
      const handleValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue="sans" onValueChange={handleValueChange}>
            <Select.Trigger />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="sans">Sans-serif</Select.Item>
                  <Select.Item value="mono">Monospace</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </form>,
      );
      expect(document.querySelector('[role="option"]')).toBe(null);
      const input = getHiddenInput();

      input.value = 'Monospace';
      await fireEvent.input(input);
      await flushMicrotasks();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('mono');
      expect((handleValueChange.mock.lastCall?.[1] as ChangeDetails).reason).toBe('none');
      expect(input.value).toBe('mono');
      expect(getFormData('font')).toEqual(['mono']);
    });

    it('selects the item whose value the browser fills in, in another case', async () => {
      const fonts = [
        { code: 'sans', name: 'Sans-serif' },
        { code: 'mono', name: 'Monospace' },
      ];
      const handleValueChange = vi.fn();
      await render(
        <Select.Root
          name="font"
          defaultValue={fonts[0]}
          itemToStringValue={(font) => font.code}
          itemToStringLabel={(font) => font.name}
          onValueChange={handleValueChange}
        >
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {fonts.map((font) => (
                  <Select.Item key={font.code} value={font}>
                    {font.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      const input = getHiddenInput();

      input.value = 'MONO';
      await fireEvent.change(input);
      await flushMicrotasks();

      expect(handleValueChange.mock.lastCall?.[0]).toBe(fonts[1]);
      expect(input.value).toBe('mono');
    });
  });

  describe('selected index', () => {
    it('follows the value while the popup is closed', async () => {
      const value = shallowRef('a');
      await render(() => (
        <Select.Root value={value.value}>
          <StoreProbe />
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      store.set('forceMounted', true);
      await flushMicrotasks();
      expect(store.state.selectedIndex).toBe(0);

      value.value = 'b';
      await flushMicrotasks();

      expect(store.state.selectedIndex).toBe(1);
    });

    it('is null for a new value after the items unmount', async () => {
      const value = shallowRef('a');
      const open = shallowRef(true);
      await render(() => (
        <Select.Root value={value.value} open={open.value}>
          <StoreProbe />
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              {/* The trigger mounts the items when it gets the focus back. */}
              <Select.Popup finalFocus={false}>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();
      expect(store.state.selectedIndex).toBe(0);

      open.value = false;
      await waitFor(() => {
        expect(screen.queryByRole('option')).toBe(null);
      });
      value.value = 'b';
      await flushMicrotasks();

      expect(store.state.selectedIndex).toBe(null);
    });
  });

  describe('BUG-6206: a native reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('puts an uncontrolled select back to its default value', async () => {
      const handleValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Select.Root name="font" defaultValue="sans" onValueChange={handleValueChange}>
            <StoreProbe />
            <Select.Trigger>
              <Select.Value data-testid="value" />
            </Select.Trigger>
          </Select.Root>
        </form>,
      );
      await setValueAsItem('serif');
      expect(getFormData('font')).toEqual(['serif']);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(screen.getByTestId('value')).toHaveTextContent('sans');
      expect(getFormData('font')).toEqual(['sans']);
      expect(handleValueChange).toHaveBeenCalledTimes(2);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('sans');
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('reset');

      // A reset with nothing to change.
      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(handleValueChange).toHaveBeenCalledTimes(2);
    });

    it('puts the values of an uncontrolled multiple select back', async () => {
      await render(
        <form data-testid="form">
          <Select.Root multiple name="tags" defaultValue={['b']}>
            <StoreProbe />
            <Select.Trigger>
              <Select.Value data-testid="value" />
            </Select.Trigger>
          </Select.Root>
        </form>,
      );
      await setValueAsItem(['b', 'c']);
      expect(getFormData('tags')).toEqual(['b', 'c']);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(screen.getByTestId('value')).toHaveTextContent('b');
      expect(getFormData('tags')).toEqual(['b']);
    });

    it('removes the filled state of the field when it clears the value', async () => {
      await render(
        <form data-testid="form">
          <Field.Root data-testid="field">
            <Select.Root name="font">
              <StoreProbe />
              <Select.Trigger />
            </Select.Root>
          </Field.Root>
        </form>,
      );
      await setValueAsItem('serif');
      expect(screen.getByTestId('field')).toHaveAttribute('data-filled', '');

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-filled');
      expect(getFormData('font')).toEqual(['']);
    });

    it('does not change a controlled select', async () => {
      const handleValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Select.Root name="font" value="serif" onValueChange={handleValueChange}>
            <Select.Trigger />
          </Select.Root>
        </form>,
      );

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(getFormData('font')).toEqual(['serif']);
    });
  });

  describe('VUE-21: a native reset clears the error of the field', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function expectNeutralField() {
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-valid');
      expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
    }

    it('VUE-21: clears the error of a required select whose value the reset does not change', async () => {
      const { container } = await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="font">
            <Select.Root required>
              <Select.Trigger />
            </Select.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      container.addEventListener('submit', (event) => event.preventDefault());
      await fireEvent.submit(screen.getByTestId('form'));
      expect(screen.getByTestId('field')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toBeInTheDocument();

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expectNeutralField();
      expect(getHiddenInput().validity.valueMissing).toBe(true);
    });

    it('VUE-21: clears the error when the reset changes the value, and does not validate it', async () => {
      const validate = vi.fn((value: unknown) => (value === 'serif' ? 'Not serif' : null));
      await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="font" validate={validate} validationMode="onChange">
            <Select.Root defaultValue="sans">
              <StoreProbe />
              <Select.Trigger />
            </Select.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await setValueAsItem('serif');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toHaveTextContent('Not serif');
      expect(validate).toHaveBeenCalledTimes(1);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settleReset();

      expect(validate).toHaveBeenCalledTimes(1);
      expectNeutralField();

      await setValueAsItem('serif');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('error')).toHaveTextContent('Not serif');
    });
  });

  describe('VUE-52: prop: items', () => {
    it('VUE-52: follows a key that the consumer adds in place to a reactive items record', async () => {
      const items = reactive<Record<string, string>>({ sans: 'Sans-serif' });
      await render(() => (
        <Select.Root defaultValue="mono" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>
      ));
      expect(screen.getByTestId('value')).toHaveTextContent('mono');

      items.mono = 'Monospace';
      await flushMicrotasks();

      expect(screen.getByTestId('value')).toHaveTextContent('Monospace');
    });
  });

  describe('server render', () => {
    it('hydrates a closed select that has a value, a name and items, and a label after the trigger', async () => {
      const props = {
        id: 'font',
        name: 'font',
        defaultValue: 'serif',
        items: { sans: 'Sans-serif', serif: 'Serif' },
        label: 'after',
      };
      const serverHtml = await renderOnServer(
        'src/select/root/SelectRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(SelectRootHydration, { serverHtml, props });

      const trigger = container.querySelector('[role="combobox"]');
      expect(trigger).toHaveTextContent('Serif');
      expect(trigger).toHaveAttribute('aria-labelledby', 'font-label');
      expect(container.querySelector('input')).toHaveValue('serif');
    });

    it('hydrates a select with no value and a placeholder', async () => {
      const props = { id: 'font', placeholder: 'Pick a font' };
      const serverHtml = await renderOnServer(
        'src/select/root/SelectRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(SelectRootHydration, { serverHtml, props });

      const trigger = container.querySelector('[role="combobox"]');
      expect(trigger).toHaveAttribute('data-placeholder');
      expect(trigger).toHaveTextContent('Pick a font');
    });
  });
});
