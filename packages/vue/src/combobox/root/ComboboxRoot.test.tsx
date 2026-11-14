import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  KeepAlive,
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onScopeDispose,
  reactive,
  shallowRef,
  toRaw,
  useId,
  watch,
} from 'vue';
import type { ComputedRef, PropType, ShallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
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
  renderOnServer,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitForPositioned,
  waitSingleFrame,
} from '#test-utils';
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as Autocomplete from '../../autocomplete/index.parts';
import * as Dialog from '../../dialog/index.parts';
import * as Popover from '../../popover/index.parts';
import * as ComboboxSeparatorDataAttributes from '../../separator/SeparatorDataAttributes';
import * as Combobox from '../index.parts';
import type { ComboboxStore } from '../store';
import { useComboboxInputValueContext, useComboboxRootContext } from './ComboboxRootContext';
import type { ComboboxInputElementValue } from './ComboboxRootContext';
import ComboboxRootHydration from './ComboboxRootHydration.test.vue';
import ComboboxRootRenders from './ComboboxRootRenders.test.vue';

// Most cases of Vase UI's own use the fixture parts in place of the positioner, the list and the
// items, and they test the root. Most of them also use the fixture input. It handles only the
// `input` event, and its `insidePopup` prop stands for a positioner around it. The Base UI cases
// of this file render the parts of the family. A ported case replaces the case of Vase UI's own
// that tests the same thing: the order of the events, a canceled change, the controlled values,
// the hidden inputs, the autofill, the field and the server render. One Base UI case of this file
// renders only the root. It is in the block `coverage edge cases`.

const HYDRATION_FILE = 'src/combobox/root/ComboboxRootHydration.test.vue';
const cities = ['Malmö', 'Malta', 'Oslo'];

// The animation lasts 100 s, so a busy machine cannot end the exit before a case acts.
const closeAnimationStyle = `
  @keyframes combobox-close-test {
    to {
      opacity: 0;
    }
  }

  .animation-test-popup[data-ending-style] {
    animation: combobox-close-test 100s linear;
  }
`;

let store: ComboboxStore;
const StoreProbe = defineComponent(() => {
  store = useComboboxRootContext();
  return () => null;
});

const SelectedIndexProbe = defineComponent(() => {
  const rootStore = useComboboxRootContext();
  const selectedIndex = computed(() => rootStore.select('selectedIndex'));
  return () => (
    <div data-testid="selected-index">
      {selectedIndex.value === null ? 'null' : `${selectedIndex.value}`}
    </div>
  );
});

function getInput() {
  return screen.getByRole<HTMLInputElement>('combobox');
}

function getHiddenInput() {
  return document.querySelector<HTMLInputElement>('input[aria-hidden]')!;
}

function getOptions() {
  return screen.queryAllByRole('option').map((option) => option.textContent?.trim());
}

function getFormData(name: string) {
  return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll(name);
}

async function type(text: string) {
  await fireEvent.input(getInput(), { target: { value: text }, inputType: 'insertText' });
  await flushMicrotasks();
}

// WebKit sends a `mousemove` with no movement under a pointer that does not move, and the list
// ignores such an event (https://github.com/mui/base-ui/issues/4002). The `mousemove` of
// `user.hover` has no movement.
async function moveOver(element: HTMLElement) {
  await fireEvent.mouseMove(element, { movementX: 1 });
}

async function pick(label: string) {
  await fireEvent.click(screen.getByRole('option', { name: label }));
  await flushMicrotasks();
}

function isElementOrAncestorInert(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.getAttribute('aria-hidden') === 'true' ||
      current.hasAttribute('inert') ||
      current.hasAttribute('data-vase-ui-inert')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function getServerOptions(serverHtml: string) {
  const template = document.createElement('template');
  template.innerHTML = serverHtml;
  return [...template.content.querySelectorAll('[role="option"]')].map(
    (option) => option.textContent,
  );
}

// A call with no locale uses `runtimeLocale`.
function spyOnCollator(runtimeLocale: string) {
  const Collator = Intl.Collator;
  const collatorSpy = vi
    .spyOn(Intl, 'Collator')
    .mockImplementation(function CountedCollator(requestedLocale, options) {
      return new Collator(requestedLocale ?? runtimeLocale, options);
    });
  onTestFinished(() => collatorSpy.mockRestore());
}

describe('<Combobox.Root />', () => {
  const { render } = createRenderer();

  // `getFilter` keeps the filter for no locale, with the runtime locale of its first use. These
  // cases are thus the first cases of the file.
  describe('VUE-44: the locale of the filter', () => {
    it('VUE-44: filters with en-US until the root is mounted when it has no locale', async () => {
      spyOnCollator('sv');
      const props = { inline: true, defaultInputValue: 'malmo' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      expect(getServerOptions(serverHtml)).toEqual(['Malmö']);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      // The collator of `sv` does not match `ö` with `o`.
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    });

    it('VUE-44: uses the locale of the developer on the server and in the browser', async () => {
      const props = { inline: true, defaultInputValue: 'malmo', locale: 'sv' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      expect(getServerOptions(serverHtml)).toEqual([]);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    });
  });

  describe('closing before the popup attaches', () => {
    it('unmounts the popup when a layout effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent(() => {
        const open = shallowRef(true);
        onMounted(() => {
          open.value = false;
        });
        return () => (
          <Combobox.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      });

      await render(<App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('listbox', { hidden: true })).toBe(null);
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
          <Combobox.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
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
    await render(<Combobox.Separator orientation="vertical" />);

    const separator = screen.getByRole('presentation');
    expect(separator).toHaveAttribute(ComboboxSeparatorDataAttributes.orientation, 'vertical');
  });

  describe('IME composition', () => {
    // Browsers report keyCode 229 for every keydown an IME handles, including the committing Enter.
    it('does not select the highlighted item with an Enter that commits IME text', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root items={['a', 'b', 'c']} onValueChange={onValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      input.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      const optionA = await screen.findByRole('option', { name: 'a' });
      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      await fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, which: 229 });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(optionA).toHaveAttribute('data-highlighted');
    });

    it('does not move the highlight with arrow keys that pick an IME candidate', async () => {
      const { user } = await render(
        <Combobox.Root items={['a', 'b', 'c']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      input.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      const optionA = await screen.findByRole('option', { name: 'a' });
      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      // Chrome reports keys handled by an active IME composition with keyCode 229.
      await fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 229, which: 229 });
      await flushMicrotasks();

      expect(optionA).toHaveAttribute('data-highlighted');
    });
  });

  it('calls onOpenChangeComplete after the closed popup resets the input', async () => {
    const calls: string[] = [];
    const { user } = await render(
      <Combobox.Root
        onInputValueChange={(value: string) => calls.push(`inputValueChange:${value}`)}
        onOpenChangeComplete={(open: boolean) => calls.push(`openChangeComplete:${open}`)}
      >
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.type(screen.getByTestId('input'), 'ap');
    await waitFor(() => expect(calls).toContain('openChangeComplete:true'));
    calls.length = 0;

    await user.click(document.body);
    await waitFor(() => expect(calls).toContain('openChangeComplete:false'));
    expect(calls).toEqual(['inputValueChange:', 'openChangeComplete:false']);
  });

  describe('manual unmount lifecycle', () => {
    interface PopupProps {
      open?: boolean;
      defaultOpen?: boolean;
      onOpenChange?: (open: boolean, details: Combobox.Root.OpenChangeEventDetails) => void;
      onOpenChangeComplete?: (open: boolean) => void;
      actionsRef?: ShallowRef<Combobox.Root.Actions | null>;
    }

    const Popup = defineComponent(
      (props: PopupProps) => {
        const open = shallowRef(props.defaultOpen ?? false);
        return () => (
          <Combobox.Root
            ref={props.actionsRef}
            defaultOpen={props.defaultOpen}
            open={props.open ?? open.value}
            onOpenChange={(nextOpen: boolean, details: Combobox.Root.OpenChangeEventDetails) => {
              props.onOpenChange?.(nextOpen, details);
              if (!details.isCanceled) {
                open.value = nextOpen;
              }
            }}
            onOpenChangeComplete={props.onOpenChangeComplete}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      },
      { props: ['open', 'defaultOpen', 'onOpenChange', 'onOpenChangeComplete', 'actionsRef'] },
    );

    it('automatically unmounts with an actions ref and completes closing once', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />,
      );

      expect(onOpenChangeComplete).not.toHaveBeenCalled();
      await user.click(screen.getByRole('combobox'));
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

      // Calling the action after the automatic unmount must not repeat the completion.
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('keeps the popup mounted until the unmount action completes closing', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

      await setProps({ open: true });
      await screen.findByRole('listbox');
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(2);
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

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      await setProps({ open: true });
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
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

      await user.click(screen.getByRole('option'));
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      cancel = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });

    it('keeps the opt-out when a controlled close is applied in a transition', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const App = defineComponent(() => {
        const open = shallowRef(true);
        return () => (
          <Popup
            open={open.value}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen) {
                details.preventUnmountOnClose();
              }
              void nextTick(() => {
                open.value = nextOpen;
              });
            }}
          />
        );
      });

      const { user } = await render(<App />);
      await user.click(screen.getByRole('option'));
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'),
      );
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('closes through the `close` action so `onOpenChange` can opt out', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const reasons: string[] = [];
      await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      actionsRef.value!.close();
      await flushMicrotasks();
      expect(reasons).toEqual([REASONS.imperativeAction]);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('ignores `unmount` while the popup is open', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      await render(
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />,
      );
      const popup = screen.getByRole('listbox');

      actionsRef.value!.unmount();
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toBe(popup);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    });

    it('unmounts when `close` and `unmount` are called in one batch', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      actionsRef.value!.close();
      actionsRef.value!.unmount();
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('still unmounts on a later close after `unmount` was called while open', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />,
      );

      // A stale exit-animation callback can call `unmount()` after a quick reopen.
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it('still unmounts on a later close after `unmount` and a reopen in one batch', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      let reopenOnComplete = true;
      let optOut = true;
      const App = defineComponent(() => {
        const open = shallowRef(true);
        return () => (
          <Popup
            open={open.value}
            actionsRef={actionsRef}
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
      actionsRef.value!.close();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

      optOut = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(2);
    });

    it('completes closing once when `unmount` is called twice in one batch', async () => {
      const actionsRef = shallowRef<Combobox.Root.Actions | null>(null);
      const onOpenChangeComplete = vi.fn();
      const { user } = await render(
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.value!.unmount();
      actionsRef.value!.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });
  });

  it('does not focus input when closing via trigger click (input inside popup)', async () => {
    const { user } = await render(
      <Combobox.Root items={['One', 'Two', 'Three']}>
        <Combobox.Trigger data-testid="trigger">
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup aria-label="Demo">
              <Combobox.Input data-testid="input" aria-label="combobox-input" />
              <Combobox.List>
                {{
                  item: ({ item }: { item: string }) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  ),
                }}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);

    expect(await screen.findByRole('listbox')).not.toBe(null);

    const input = await screen.findByRole('combobox', { name: 'combobox-input' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  describe('input inside popup composition', () => {
    it('selects with the keyboard, restores focus, and resets the query on reopen', async () => {
      const items = ['Apple', 'Banana', 'Cherry'];
      const { user } = await render(
        <Combobox.Root items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select a fruit" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Fruits">
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ban');
      await user.keyboard('{ArrowDown}{Enter}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('Banana');

      await user.click(trigger);

      const reopenedInput = await screen.findByTestId('input');
      expect(reopenedInput).toHaveValue('');

      const banana = await screen.findByRole('option', { name: 'Banana' });
      expect(banana).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
    });

    it('discards an uncommitted query on Escape and preserves the selection', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          items={['Apple', 'Banana', 'Cherry']}
          defaultValue="Apple"
          onValueChange={onValueChange}
        >
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Fruits">
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      await user.type(await screen.findByTestId('input'), 'ban');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('Apple');
      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('');
      expect(await screen.findByRole('option', { name: 'Apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(await screen.findByRole('option', { name: 'Banana' })).not.toBe(null);
    });

    it('keeps filtering responsive when the selection close is canceled', async () => {
      const { user } = await render(
        <Combobox.Root
          items={['Apple', 'Apricot', 'Banana']}
          onOpenChange={(open: boolean, eventDetails: Combobox.Root.OpenChangeEventDetails) => {
            if (!open) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select a fruit" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Fruits">
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      const input = await screen.findByTestId('input');
      await user.type(input, 'ap');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(screen.getByTestId('trigger')).toHaveTextContent('Apple');

      await user.clear(input);
      await user.type(input, 'ba');

      expect(await screen.findByRole('option', { name: 'Banana' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'Apple' })).toBe(null);
    });
  });

  it('does not aria-hide the input group when the input is outside the popup', async () => {
    const { user } = await render(
      <Combobox.Root items={['apple', 'banana']}>
        <Combobox.InputGroup data-testid="group">
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    const group = screen.getByTestId('group');

    await user.click(input);
    expect(await screen.findByRole('listbox')).not.toBe(null);
    await flushMicrotasks();

    expect(input).toHaveFocus();
    expect(group).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('dismisses the popup when clicking a plain wrapper around the input', async () => {
    const { user } = await render(
      <Combobox.Root items={['apple', 'banana']}>
        <div style={{ padding: '10px' }}>
          <span data-testid="pad">padding</span>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('listbox')).not.toBe(null);

    await user.click(screen.getByTestId('pad'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('does not dismiss when pressing content inside a nested popover', async () => {
    const { user } = await render(
      <Combobox.Root defaultOpen>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
              <Popover.Root>
                <Popover.Trigger>Open nested popover</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>
                      <button type="button">Nested focusable content</button>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Open nested popover' }));

    await user.click(await screen.findByRole('button', { name: 'Nested focusable content' }));

    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  it('wraps modal focus from popup controls back to the input', async () => {
    const { user } = await render(
      <Combobox.Root defaultOpen modal>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <button type="button">Extra control</button>
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const extraControl = screen.getByRole('button', { name: 'Extra control' });

    input.focus();
    await user.tab();
    expect(extraControl).toHaveFocus();

    await user.tab();
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('does not cause infinite re-renders when items becomes undefined', async () => {
    const { rerender } = await render(
      <Combobox.Root items={[]} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await rerender(
      <Combobox.Root items={undefined} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides the trigger when popup is open with input outside the popup', async () => {
    const { user } = await render(
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root items={['Apple', 'Banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>,
    );

    await user.click(screen.getByTestId('input'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    const outside = screen.getByTestId('outside');
    const trigger = screen.getByTestId('trigger');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    expect(isElementOrAncestorInert(trigger)).toBe(true);
  });

  it('does not render the start dismiss button while closed', async () => {
    await render(
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {{
                  item: ({ item }: { item: string }) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  ),
                }}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBe(null);
  });

  it('renders internal dismiss buttons before the input and after the popup', async () => {
    const { user } = await render(
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root defaultOpen modal items={['Apple', 'Banana']}>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup" aria-label="Demo">
                <Combobox.Input aria-label="Combobox input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>,
    );

    const popup = screen.getByTestId('popup');
    const input = screen.getByRole('combobox', { name: 'Combobox input' });
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });
    const outside = screen.getByTestId('outside');

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    await user.click(endDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('renders an internal dismiss button for the input-outside-popup pattern', async () => {
    const { user } = await render(
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {{
                  item: ({ item }: { item: string }) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  ),
                }}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByTestId('input'));

    const popup = await screen.findByTestId('popup');
    const input = screen.getByTestId('input');
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await user.click(startDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  describe('events', () => {
    it('emits valueChange, update:value, inputValueChange, update:inputValue, openChange and update:open in this order for a pick', async () => {
      const events: string[] = [];
      let inputValue: ComputedRef<ComboboxInputElementValue>;
      const InputValueProbe = defineComponent(() => {
        inputValue = useComboboxInputValueContext();
        return () => null;
      });
      await render(
        <Combobox.Root
          items={cities}
          onValueChange={(value, details) =>
            events.push(`valueChange:${String(value)}:${details.reason}`)
          }
          onInputValueChange={(value, details) =>
            events.push(
              `inputValueChange:${String(value)}:${details.reason}:${String(inputValue.value)}`,
            )
          }
          onOpenChange={(open, details) => events.push(`openChange:${open}:${details.reason}`)}
          {...{
            'onUpdate:value': (value: unknown) => events.push(`update:value:${String(value)}`),
            'onUpdate:inputValue': (value: unknown) =>
              events.push(`update:inputValue:${String(value)}`),
            'onUpdate:open': (value: unknown) => events.push(`update:open:${String(value)}`),
          }}
        >
          <InputValueProbe />
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );

      await type('ma');

      expect(events.splice(0)).toEqual([
        'inputValueChange:ma:input-change:',
        'update:inputValue:ma',
        'openChange:true:input-change',
        'update:open:true',
      ]);

      await pick('Malta');

      expect(events).toEqual([
        'valueChange:Malta:item-press',
        'update:value:Malta',
        'inputValueChange:Malta:item-press:ma',
        'update:inputValue:Malta',
        'openChange:false:item-press',
        'update:open:false',
      ]);
    });

    it.each([
      {
        name: 'valueChange',
        expected: { input: 'ma', value: '', expanded: 'true', updates: ['inputValue', 'open'] },
      },
      {
        name: 'inputValueChange',
        expected: { input: '', value: '', expanded: 'false', updates: [] },
      },
      {
        name: 'openChange',
        expected: { input: 'ma', value: '', expanded: 'false', updates: ['inputValue'] },
      },
    ])(
      'keeps the value, the input and the open state when a listener of $name cancels',
      async ({ name, expected }) => {
        const updates: string[] = [];
        const cancel = (details: { cancel: () => void }) => details.cancel();
        await render(
          <Combobox.Root
            name="city"
            items={cities}
            {...{
              [`on${name[0].toUpperCase()}${name.slice(1)}`]: (_: unknown, details: any) =>
                cancel(details),
              'onUpdate:value': () => updates.push('value'),
              'onUpdate:inputValue': () => updates.push('inputValue'),
              'onUpdate:open': () => updates.push('open'),
            }}
          >
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>,
        );

        await type('ma');
        if (name === 'valueChange') {
          await pick('Malta');
        }

        expect({
          input: getInput().value,
          value: getHiddenInput().value,
          expanded: getInput().getAttribute('aria-expanded'),
          updates,
        }).toEqual(expected);
      },
    );

    it('keeps the typed filter while the popup closes after a pick', async () => {
      const root = shallowRef<Combobox.Root.Actions | null>(null);
      await render(() => (
        <Combobox.Root
          ref={root}
          items={cities}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      ));

      await type('ma');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      await pick('Malta');

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      root.value!.unmount();
      await flushMicrotasks();

      expect(getOptions()).toEqual([]);
      expect(getInput().value).toBe('Malta');
    });
  });

  describe('controlled values', () => {
    it('asks one time when a listener cancels and the label function changes in the same flush', async () => {
      const value = shallowRef('Malta');
      const upperCase = shallowRef(false);
      const handleInputValueChange = vi.fn((_: string, details: { cancel: () => void }) =>
        details.cancel(),
      );
      await render(() => (
        <Combobox.Root
          items={cities}
          value={value.value}
          itemToStringLabel={upperCase.value ? (city: string) => city.toUpperCase() : undefined}
          onInputValueChange={handleInputValueChange}
        >
          <ComboboxInputPart />
        </Combobox.Root>
      ));

      value.value = 'Oslo';
      upperCase.value = true;
      await flushMicrotasks();

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('OSLO');
      expect(getInput().value).toBe('Malta');
    });

    it('follows a controlled input value', async () => {
      const inputValue = shallowRef('os');
      await render(() => (
        <Combobox.Root items={cities} inputValue={inputValue.value}>
          <ComboboxInputPart />
        </Combobox.Root>
      ));

      // The listener does not take the typed text.
      await type('osl');

      expect(getInput().value).toBe('os');

      inputValue.value = 'osl';
      await flushMicrotasks();

      expect(getInput().value).toBe('osl');
    });

    it('keeps the input value when it has no controlled value', async () => {
      await render(
        <Combobox.Root items={cities} defaultValue="Oslo">
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      expect(getInput().value).toBe('Oslo');

      await type('mal');
      expect(getInput().value).toBe('mal');

      await pick('Malta');

      expect(getInput().value).toBe('Malta');
    });
  });

  describe('filter', () => {
    it('runs the filter one time for a change of the query and not for a change of another prop', async () => {
      const filter = vi.fn((city: string, query: string) =>
        city.toLowerCase().includes(query.toLowerCase()),
      );
      const disabled = shallowRef(false);
      const name = shallowRef<string | undefined>(undefined);
      await render(() => (
        <Combobox.Root items={cities} filter={filter} disabled={disabled.value} name={name.value}>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      ));

      await type('ma');

      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(filter).toHaveBeenCalledTimes(cities.length);

      disabled.value = true;
      await flushMicrotasks();
      name.value = 'city';
      await flushMicrotasks();

      expect(filter).toHaveBeenCalledTimes(cities.length);
    });

    // A regression check of the `items` prop: the root keeps no copy of the list.
    it('shows an item that the consumer adds in place to a reactive items list', async () => {
      const items = reactive(['Malmö', 'Malta']);
      await render(() => (
        <Combobox.Root items={items} defaultOpen>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      ));
      expect(getOptions()).toEqual(['Malmö', 'Malta']);

      items.push('Oslo');
      await flushMicrotasks();

      expect(getOptions()).toEqual(['Malmö', 'Malta', 'Oslo']);
    });
  });

  describe('highlight', () => {
    async function renderList(props: Record<string, unknown> = {}) {
      const handleItemHighlighted = vi.fn();
      const view = await render(
        <Combobox.Root
          id="city"
          items={cities}
          onItemHighlighted={handleItemHighlighted}
          {...props}
        >
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      const highlights = () =>
        handleItemHighlighted.mock.calls.map(
          ([value, details]) => `${value}:${details.index}:${details.reason}`,
        );
      return { ...view, handleItemHighlighted, highlights };
    }

    function getOptionId(label: string) {
      return screen.getByRole('option', { name: label }).id;
    }

    async function press(key: string) {
      await fireEvent.keyDown(getInput(), { key });
      await flushMicrotasks();
    }

    it('highlights the first item for typed text with autoHighlight', async () => {
      const { highlights } = await renderList({ autoHighlight: true });

      await type('ma');

      expect(highlights()).toEqual(['Malmö:0:none']);
      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malmö'));
      expect(getInput()).toHaveAttribute('aria-controls', 'city-list');
    });

    it('emits itemHighlighted one time for each change, with the reason keyboard for an arrow key', async () => {
      const { highlights } = await renderList({ autoHighlight: true });

      await type('ma');
      await press('ArrowDown');
      await type('mal');
      await type('o');

      expect(highlights()).toEqual([
        'Malmö:0:none',
        'Malta:1:keyboard',
        'Malmö:0:none',
        'Oslo:0:none',
      ]);
    });

    it('clears the highlight when no item matches', async () => {
      const { highlights } = await renderList({ autoHighlight: true });

      await type('ma');
      await type('zzz');

      expect(highlights()).toEqual(['Malmö:0:none', 'undefined:-1:none']);
      expect(getInput()).not.toHaveAttribute('aria-activedescendant');
    });

    it('highlights the first item at the open with autoHighlight always', async () => {
      const { highlights } = await renderList({ autoHighlight: 'always' });

      await fireEvent.mouseDown(getInput());
      await flushMicrotasks();

      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(highlights()).toEqual(['Malmö:0:none']);
      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malmö'));
    });

    it('does not highlight for autofill text', async () => {
      const { highlights } = await renderList({ autoHighlight: true });
      await fireEvent.mouseDown(getInput());
      await flushMicrotasks();
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.input(getInput(), {
        target: { value: 'ma' },
        inputType: 'insertReplacementText',
      });
      await flushMicrotasks();

      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(highlights()).toEqual([]);
    });

    it('returns the highlight to the selected item after a clear by a pick (input in the popup, multiple)', async () => {
      const { highlights } = await renderList({
        inline: true,
        open: true,
        multiple: true,
        defaultValue: ['Malmö'],
        autoHighlight: true,
      });
      getInput().focus();

      await type('mal');
      expect(highlights()).toEqual(['Malmö:0:none']);

      await pick('Malta');

      expect(getInput().value).toBe('');
      expect(getOptions()).toEqual(cities);
      expect(highlights()).toEqual(['Malmö:0:none', 'Malta:1:none']);
      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malta'));
    });

    it('aria-activedescendant names the active item and the input keeps the focus', async () => {
      await renderList();
      getInput().focus();

      await type('ma');
      expect(getInput()).not.toHaveAttribute('aria-activedescendant');

      await press('ArrowDown');

      expect(getInput()).toHaveAttribute('aria-activedescendant', getOptionId('Malmö'));
      expect(getInput()).toHaveFocus();
    });

    it('emits no highlight while the popup closes', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { container, highlights } = await renderList({ defaultValue: 'Malta' });
      // The popup of the fixture list is the parent of the list. Its animation holds the close.
      const style = document.createElement('style');
      style.textContent =
        '@keyframes hold { to { opacity: 0.5; } } div:has(> #city-list) { animation: hold 100s; }';
      container.append(style);
      getInput().focus();
      await fireEvent.mouseDown(getInput());
      await flushMicrotasks();
      expect(getOptions()).toEqual(cities);

      await press('Escape');
      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(getOptions()).toEqual(cities);

      await press('ArrowDown');

      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(highlights()).toEqual([]);

      for (const animation of document.getAnimations()) {
        animation.finish();
      }
    });

    it('keeps the highlight of the popup that a controlled root closes for the typed text', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const open = shallowRef(true);
      const activeIndices: (number | null)[] = [];
      const ActiveIndexRecorder = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        watch(
          () => rootStore.select('activeIndex'),
          (activeIndex) => activeIndices.push(activeIndex),
          { flush: 'sync' },
        );
        return () => null;
      });
      const { container } = await render(() => (
        <Combobox.Root
          id="city"
          items={cities}
          autoHighlight
          open={open.value}
          onInputValueChange={(value: string) => {
            if (value === 'mal') {
              open.value = false;
            }
          }}
        >
          <ActiveIndexRecorder />
          <Combobox.Input />
          <ComboboxListPart />
        </Combobox.Root>
      ));
      // The popup of the fixture list is the parent of the list. Its animation holds the close.
      const style = document.createElement('style');
      style.textContent =
        '@keyframes hold { to { opacity: 0.5; } } div:has(> #city-list) { animation: hold 100s; }';
      container.append(style);
      getInput().focus();
      await type('ma');
      await fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
      await flushMicrotasks();
      expect(activeIndices).toEqual([0, 1]);

      await type('mal');

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(activeIndices).toEqual([0, 1]);

      for (const animation of document.getAnimations()) {
        animation.finish();
      }
    });

    it('returns the highlight to the selected item after a clear of the text in a root that the consumer opens', async () => {
      const { user } = await render(
        <Combobox.Root open multiple items={cities} defaultValue={['Malta']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      getInput().focus();
      await user.keyboard('os');
      await waitFor(() => expect(getOptions()).toEqual(['Oslo']));
      await user.keyboard('{Backspace}{Backspace}');
      await waitFor(() => expect(getOptions()).toEqual(cities));

      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Malta' })).toHaveAttribute('data-highlighted'),
      );
    });
  });

  describe('store', () => {
    it('the store has the props bags and the modes in the first render of a part', async () => {
      let firstRender: Record<string, unknown> = {};
      const FirstRenderProbe = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        firstRender = {
          role: rootStore.select('inputProps').role,
          selectionMode: rootStore.select('selectionMode'),
          name: rootStore.select('name'),
          disabled: rootStore.select('disabled'),
          inline: rootStore.select('inline'),
          itemRootId: rootStore.select('itemRoot').id,
          hasPopupListeners: Object.keys(rootStore.select('popupProps')).length > 0,
        };
        return () => null;
      });

      await render(
        <Combobox.Root id="city" name="city" multiple disabled inline items={cities}>
          <FirstRenderProbe />
        </Combobox.Root>,
      );

      expect(firstRender).toEqual({
        role: 'combobox',
        selectionMode: 'multiple',
        name: 'city',
        disabled: true,
        inline: true,
        itemRootId: 'city',
        hasPopupListeners: true,
      });
    });

    it('follows a change of each mode prop', async () => {
      const modes = shallowRef<Record<string, unknown>>({});
      const readState = () => {
        const state = toRaw(store.state);
        return {
          disabled: state.disabled,
          readOnly: state.readOnly,
          required: state.required,
          inline: state.inline,
          grid: state.grid,
          modal: state.modal,
          virtualized: state.virtualized,
          openOnInputClick: state.openOnInputClick,
          autoHighlight: state.autoHighlight,
          name: state.name,
          form: state.form,
        };
      };
      await render(() => (
        <Combobox.Root items={cities} {...modes.value}>
          <StoreProbe />
        </Combobox.Root>
      ));
      expect(readState()).toEqual({
        disabled: false,
        readOnly: false,
        required: false,
        inline: false,
        grid: false,
        modal: false,
        virtualized: false,
        openOnInputClick: true,
        autoHighlight: false,
        name: undefined,
        form: undefined,
      });

      modes.value = {
        disabled: true,
        readOnly: true,
        required: true,
        inline: true,
        grid: true,
        modal: true,
        virtualized: true,
        openOnInputClick: false,
        autoHighlight: true,
        name: 'city',
        form: 'checkout',
      };
      await flushMicrotasks();

      expect(readState()).toEqual({
        disabled: true,
        readOnly: true,
        required: true,
        inline: true,
        grid: true,
        modal: true,
        virtualized: true,
        openOnInputClick: false,
        autoHighlight: 'input-change',
        name: 'city',
        form: 'checkout',
      });
    });

    it('a part that mounts in the first render gets the real commands', async () => {
      const handleInputValueChange = vi.fn();
      let called = false;
      const EarliestCommandProbe = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        return () => (
          <span
            ref={(element) => {
              if (element && !called) {
                called = true;
                rootStore.context.setInputValue('Oslo', createChangeEventDetails(REASONS.none));
              }
            }}
          />
        );
      });

      await render(
        <Combobox.Root items={cities} onInputValueChange={handleInputValueChange}>
          <EarliestCommandProbe />
        </Combobox.Root>,
      );

      expect(called).toBe(true);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Oslo');
    });
  });

  describe('hidden inputs', () => {
    it('submits the serialized value', async () => {
      const malta = { value: 'MT', label: 'Malta' };
      await render(
        <form data-testid="form">
          <Combobox.Root name="city" items={[malta]} defaultValue={malta}>
            <ComboboxInputPart />
          </Combobox.Root>
        </form>,
      );

      expect(getFormData('city')).toEqual(['MT']);
      expect(getInput().value).toBe('Malta');
    });

    it('submits one entry for each value of a multiple selection', async () => {
      await render(
        <form data-testid="form">
          <Combobox.Root name="city" multiple items={cities} defaultValue={['Oslo']}>
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      expect(getFormData('city')).toEqual(['Oslo']);

      await type('ma');
      await pick('Malta');

      expect(getFormData('city')).toEqual(['Oslo', 'Malta']);
      expect(getHiddenInput()).not.toHaveAttribute('name');
    });

    it('the input has the name when the root selects nothing', async () => {
      await render(
        <form data-testid="form">
          <Autocomplete.Root name="search" items={cities}>
            <ComboboxInputPart />
          </Autocomplete.Root>
        </form>,
      );

      await type('ma');

      expect(getFormData('search')).toEqual(['ma']);
      expect(getInput()).toHaveAttribute('name', 'search');
      expect(getHiddenInput()).not.toHaveAttribute('name');
    });

    it('is not valid when required and empty', async () => {
      const { unmount } = await render(
        <Combobox.Root name="city" required items={cities}>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      expect(getHiddenInput().validity.valueMissing).toBe(true);

      await type('ma');
      await pick('Malta');

      expect(getHiddenInput().validity.valid).toBe(true);
      unmount();

      await render(
        <Combobox.Root name="city" multiple required items={cities} defaultValue={['Oslo']}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      expect(getHiddenInput()).not.toHaveAttribute('required');
      expect(getHiddenInput().validity.valid).toBe(true);
    });

    it('focuses the input when the hidden input gets the focus', async () => {
      await render(
        <Combobox.Root name="city" items={cities}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      getHiddenInput().focus();
      await flushMicrotasks();

      expect(getInput()).toHaveFocus();
    });

    it('requestSubmit submits the form of the hidden input', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      await render(
        <form onSubmit={handleSubmit}>
          <Combobox.Root name="city" items={cities}>
            <StoreProbe />
          </Combobox.Root>
        </form>,
      );

      store.context.requestSubmit();

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('BUG-6206: a native reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function reset() {
      screen.getByTestId<HTMLFormElement>('form').reset();
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
    }

    it('puts an uncontrolled single root back to its default value and its label', async () => {
      const handleValueChange = vi.fn();
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            name="city"
            items={cities}
            defaultValue="Oslo"
            onValueChange={handleValueChange}
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      await type('ma');
      await pick('Malmö');
      expect(getFormData('city')).toEqual(['Malmö']);
      handleValueChange.mockClear();
      handleInputValueChange.mockClear();

      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(getInput().value).toBe('Oslo');
      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('Oslo');
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('reset');
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Oslo');
      expect(handleInputValueChange.mock.lastCall?.[1].reason).toBe('none');

      // A reset with nothing to change.
      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
    });

    it('puts the values of an uncontrolled multiple root back', async () => {
      await render(
        <form data-testid="form">
          <Combobox.Root name="city" multiple items={cities} defaultValue={['Oslo']}>
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      await type('ma');
      await pick('Malta');
      expect(getFormData('city')).toEqual(['Oslo', 'Malta']);

      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(getInput().value).toBe('');
    });

    it('puts the typed text of the input back', async () => {
      const handleValueChange = vi.fn();
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            items={cities}
            defaultValue="Oslo"
            onValueChange={handleValueChange}
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
          </Combobox.Root>
        </form>,
      );
      await type('mal');
      handleInputValueChange.mockClear();

      await reset();

      expect(getInput().value).toBe('Oslo');
      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[1].event.type).toBe('reset');
    });

    it('does not change a controlled root', async () => {
      const handleValueChange = vi.fn();
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            name="city"
            items={cities}
            value="Oslo"
            inputValue="Oslo"
            onValueChange={handleValueChange}
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
          </Combobox.Root>
        </form>,
      );

      await reset();

      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(handleInputValueChange).toHaveBeenCalledTimes(0);
      expect(getFormData('city')).toEqual(['Oslo']);
    });

    it('keeps an input inside the popup empty', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Combobox.Root
            name="city"
            items={cities}
            defaultValue="Oslo"
            onInputValueChange={handleInputValueChange}
          >
            <ComboboxInputPart insidePopup />
            <ComboboxListPart />
          </Combobox.Root>
        </form>,
      );
      await type('ma');
      await pick('Malta');
      expect(getFormData('city')).toEqual(['Malta']);

      await reset();

      expect(getFormData('city')).toEqual(['Oslo']);
      expect(getInput().value).toBe('');
      expect(handleInputValueChange.mock.calls.map(([text]) => text)).not.toContain('Oslo');
    });

    it('puts the text back when the root part holds the input value itself', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Autocomplete.Root
            name="search"
            items={cities}
            defaultValue="os"
            onValueChange={handleInputValueChange}
          >
            <ComboboxInputPart />
          </Autocomplete.Root>
        </form>,
      );
      await type('mal');
      expect(getFormData('search')).toEqual(['mal']);
      handleInputValueChange.mockClear();

      await reset();

      expect(getFormData('search')).toEqual(['os']);
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('os');
    });
  });

  describe('VUE-21: a native reset clears the error of the field', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function reset() {
      screen.getByTestId<HTMLFormElement>('form').reset();
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
    }

    function expectNeutralField() {
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-valid');
      expect(getHiddenInput()).not.toHaveAttribute('aria-invalid');
    }

    it('VUE-21: clears the error of a required root whose value the reset does not change', async () => {
      const { container } = await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="city">
            <Combobox.Root required items={cities}>
              <ComboboxInputPart />
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      container.addEventListener('submit', (event) => event.preventDefault());
      await fireEvent.submit(screen.getByTestId('form'));
      expect(screen.getByTestId('field')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toBeInTheDocument();

      await reset();

      expectNeutralField();
      expect(getHiddenInput().validity.valueMissing).toBe(true);
    });

    it('VUE-21: clears the error when the reset changes the value, and does not validate it', async () => {
      const validate = vi.fn((value: unknown) => (value === 'Malta' ? 'Not Malta' : null));
      await render(
        <Form data-testid="form">
          <Field.Root data-testid="field" name="city" validate={validate} validationMode="onChange">
            <Combobox.Root items={cities} defaultValue="Oslo">
              <ComboboxInputPart />
              <ComboboxListPart />
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await type('ma');
      await pick('Malta');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toHaveTextContent('Not Malta');
      expect(validate).toHaveBeenCalledTimes(1);

      await reset();

      expect(validate).toHaveBeenCalledTimes(1);
      expectNeutralField();

      await type('ma');
      await pick('Malta');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('error')).toHaveTextContent('Not Malta');
    });

    it('VUE-21: starts no validation for the change of a reset when the root part holds the input value', async () => {
      const validate = vi.fn((value: unknown) => (value === 'Malta' ? 'Not Malta' : null));
      await render(
        <Form data-testid="form">
          <Field.Root
            data-testid="field"
            name="search"
            validate={validate}
            validationMode="onChange"
          >
            <Autocomplete.Root items={cities} defaultValue="ma">
              <ComboboxInputPart />
            </Autocomplete.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      await type('Malta');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
      expect(screen.getByTestId('error')).toHaveTextContent('Not Malta');
      expect(validate).toHaveBeenCalledTimes(1);

      await reset();

      expect(getInput().value).toBe('ma');
      expect(validate).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
    });
  });

  describe('autofill', () => {
    async function autofill(value: string, types: readonly string[] = ['input']) {
      const input = getHiddenInput();
      input.value = value;
      for (const eventType of types) {
        input.dispatchEvent(new Event(eventType, { bubbles: true }));
      }
      await flushMicrotasks();
    }

    it('selects the item whose serialized value the browser wrote', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root name="city" items={cities} onValueChange={handleValueChange}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('malta');

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('Malta');
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(handleValueChange.mock.lastCall?.[1].event.type).toBe('input');
      expect(getHiddenInput().value).toBe('Malta');
      expect(getInput().value).toBe('Malta');
    });

    it('selects by the label', async () => {
      const items = [
        { value: 'MT', label: 'Malta' },
        { value: 'NO', label: 'Oslo' },
      ];
      await render(
        <Combobox.Root name="city" items={items}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('Oslo');

      expect(getHiddenInput().value).toBe('NO');
      expect(getInput().value).toBe('Oslo');
    });

    it('handles an input and a change event of one task one time', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root name="city" items={cities} onValueChange={handleValueChange}>
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('Malta', ['input', 'change']);

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(getHiddenInput().value).toBe('Malta');
    });

    it('ignores autofill when read-only', async () => {
      const handleValueChange = vi.fn();
      await render(
        <Combobox.Root
          name="city"
          readOnly
          items={cities}
          defaultValue="Oslo"
          onValueChange={handleValueChange}
        >
          <ComboboxInputPart />
        </Combobox.Root>,
      );

      await autofill('Malta');

      expect(handleValueChange).toHaveBeenCalledTimes(0);
      expect(getHiddenInput().value).toBe('Oslo');
    });

    it('writes the text of the input in mode none', async () => {
      const handleInputValueChange = vi.fn();
      await render(
        <Autocomplete.Root items={cities} onValueChange={handleInputValueChange}>
          <ComboboxInputPart />
        </Autocomplete.Root>,
      );

      await autofill('Oslo');

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(getInput().value).toBe('Oslo');
    });
  });

  describe('Field', () => {
    const TriggerProbe = defineComponent(() => {
      const rootStore = useComboboxRootContext();
      return () => (
        <button
          type="button"
          data-testid="trigger"
          ref={(element) => {
            if (toRaw(rootStore.state).triggerElement !== element) {
              rootStore.set('triggerElement', element as HTMLElement | null);
            }
          }}
        />
      );
    });

    async function submitInvalidForm(content: () => unknown) {
      const result = await render(() => (
        <Form>
          <Field.Root name="city">{content()}</Field.Root>
        </Form>
      ));
      result.container.addEventListener('submit', (event) => event.preventDefault());
      await fireEvent.submit(result.container.querySelector('form')!);
      await flushMicrotasks();
      return result;
    }

    it('registers the input or the trigger as the control', async () => {
      const { unmount } = await submitInvalidForm(() => (
        <Combobox.Root required items={cities}>
          <ComboboxInputPart />
        </Combobox.Root>
      ));

      expect(getInput()).toHaveFocus();
      unmount();

      await submitInvalidForm(() => (
        <Combobox.Root required items={cities}>
          <TriggerProbe />
          <ComboboxInputPart insidePopup />
        </Combobox.Root>
      ));

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('sets filled, dirty and touched', async () => {
      const { user } = await render(
        <Field.Root data-testid="field">
          <Combobox.Root items={cities}>
            <ComboboxInputPart insidePopup />
            <ComboboxListPart />
          </Combobox.Root>
        </Field.Root>,
      );
      const field = screen.getByTestId('field');
      expect(field).not.toHaveAttribute('data-filled');
      expect(field).not.toHaveAttribute('data-dirty');

      await type('ma');
      await pick('Malta');

      expect(field).toHaveAttribute('data-filled', '');
      expect(field).toHaveAttribute('data-dirty', '');
      expect(field).not.toHaveAttribute('data-touched');

      await type('os');
      await user.click(document.body);
      await flushMicrotasks();

      expect(getInput()).toHaveAttribute('aria-expanded', 'false');
      expect(field).toHaveAttribute('data-touched', '');
    });

    it('validates on a change', async () => {
      await render(
        <Field.Root
          validate={(value) => (value === 'Malta' ? 'Not Malta' : null)}
          validationMode="onChange"
        >
          <Combobox.Root items={cities}>
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      await type('ma');
      await pick('Malta');

      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Not Malta'));
    });

    it('commits on a close by an outside press when the input is in the popup', async () => {
      const { user } = await render(
        <Field.Root
          validate={(value) => (value == null ? 'Pick a city' : null)}
          validationMode="onBlur"
        >
          <Combobox.Root items={cities}>
            <ComboboxInputPart insidePopup />
            <ComboboxListPart />
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      await type('ma');
      await user.click(document.body);

      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Pick a city'));
    });
  });

  describe('KeepAlive', () => {
    function renderInKeepAlive(value: { value: string }) {
      const shown = shallowRef(true);
      const handleInputValueChange = vi.fn();
      const handleOpenChange = vi.fn();
      const view = render(() => (
        <KeepAlive>
          {shown.value ? (
            <Combobox.Root
              key="root"
              name="city"
              items={cities}
              value={value.value}
              onInputValueChange={handleInputValueChange}
              onOpenChange={handleOpenChange}
            >
              <ComboboxInputPart />
              <ComboboxListPart />
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
      return { view, shown, handleInputValueChange, handleOpenChange };
    }

    it('keeps the value, the input value and the open state', async () => {
      const { view, shown, handleOpenChange } = renderInKeepAlive(shallowRef('Oslo'));
      const { user } = await view;
      await type('ma');
      handleOpenChange.mockClear();

      shown.value = false;
      await flushMicrotasks();
      await user.click(document.body);
      shown.value = true;
      await flushMicrotasks();

      expect(handleOpenChange).toHaveBeenCalledTimes(0);
      expect(getInput().value).toBe('ma');
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(getOptions()).toEqual(['Malmö', 'Malta']);
      expect(getHiddenInput().value).toBe('Oslo');
    });

    it('removes the pageshow listener while deactivated', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      onTestFinished(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
      });
      const count = (spy: typeof addSpy | typeof removeSpy) =>
        spy.mock.calls.filter(([eventType]) => eventType === 'pageshow').length;
      const { view, shown } = renderInKeepAlive(shallowRef('Oslo'));
      await view;
      expect([count(addSpy), count(removeSpy)]).toEqual([1, 0]);

      shown.value = false;
      await flushMicrotasks();

      expect([count(addSpy), count(removeSpy)]).toEqual([1, 1]);

      shown.value = true;
      await flushMicrotasks();

      expect([count(addSpy), count(removeSpy)]).toEqual([2, 1]);
    });

    it('reports a change of the value after the activation', async () => {
      const value = shallowRef('Oslo');
      const { view, shown, handleInputValueChange } = renderInKeepAlive(value);
      await view;

      shown.value = false;
      await flushMicrotasks();
      value.value = 'Malta';
      await flushMicrotasks();

      expect(handleInputValueChange).toHaveBeenCalledTimes(0);

      shown.value = true;
      await flushMicrotasks();

      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Malta');
      expect(getInput().value).toBe('Malta');
      expect(getHiddenInput().value).toBe('Malta');
    });

    it('keeps the highlight and gives no itemHighlighted while deactivated', async () => {
      const shown = shallowRef(true);
      const handleItemHighlighted = vi.fn();
      await render(() => (
        <KeepAlive>
          {shown.value ? (
            <Combobox.Root
              key="root"
              items={cities}
              autoHighlight
              onItemHighlighted={handleItemHighlighted}
            >
              <Combobox.Input />
              <ComboboxListPart />
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
      getInput().focus();
      await type('ma');
      await fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
      await flushMicrotasks();
      const activeId = screen.getByRole('option', { name: 'Malta' }).id;
      expect(getInput()).toHaveAttribute('aria-activedescendant', activeId);
      handleItemHighlighted.mockClear();

      shown.value = false;
      await flushMicrotasks();
      shown.value = true;
      await flushMicrotasks();

      expect(handleItemHighlighted).toHaveBeenCalledTimes(0);
      expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      expect(getInput()).toHaveAttribute('aria-activedescendant', activeId);
    });
  });

  describe('server render', () => {
    function getNamedInputs(container: HTMLElement) {
      return [...container.querySelectorAll<HTMLInputElement>('input[name]')].map(
        (input) => `${input.type}:${input.name}=${input.value}`,
      );
    }

    it('hydrates a single root with a name and a value', async () => {
      const props = { name: 'city', defaultValue: 'Oslo' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      expect(container.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('Oslo');
      expect(getNamedInputs(container)).toEqual(['text:city=Oslo']);
    });

    it('hydrates a multiple root', async () => {
      const props = { name: 'city', multiple: true, defaultValue: ['Oslo', 'Malta'] };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props });

      expect(container.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('');
      expect(getNamedInputs(container)).toEqual(['hidden:city=Oslo', 'hidden:city=Malta']);
    });

    it('hydrates a root with no name', async () => {
      const serverHtml = await renderOnServer(HYDRATION_FILE, {});

      const { container } = await hydrate(ComboboxRootHydration, { serverHtml, props: {} });

      expect(getNamedInputs(container)).toEqual([]);
      expect(container.querySelector('input[aria-hidden]')).toHaveAttribute('type', 'hidden');
    });
  });

  describe('prop: id', () => {
    it('sets the id on the input when it is outside the popup', async () => {
      await render(
        <Combobox.Root id="test-id">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await waitFor(() => {
        expect(input).toHaveAttribute('id', 'test-id');
      });
    });

    it('sets the id on the trigger when the input is inside the popup', async () => {
      await render(
        <Combobox.Root id="test-id" defaultOpen>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const input = screen.getByTestId('input');

      expect(trigger).toHaveAttribute('id', 'test-id');
      expect(input).not.toHaveAttribute('id', 'test-id');
    });
  });

  describe('prop: disabled', () => {
    it('should render disabled state on all interactive components', async () => {
      const { user } = await render(
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('disabled');

      // Verify interactions are disabled
      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should not open popup when disabled', async () => {
      const { user } = await render(
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should prevent keyboard interactions when disabled', async () => {
      const { user } = await render(
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should set disabled attribute on hidden input', async () => {
      await render(
        <Combobox.Root disabled name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('disabled');
    });
  });

  describe('prop: required', () => {
    it('does not mark the hidden input as required when selection exists in multiple mode', async () => {
      await render(
        <Combobox.Root multiple required name="languages" value={['a']}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists in multiple mode', async () => {
      await render(
        <Combobox.Root multiple required name="languages" value={[]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).toHaveAttribute('required');
    });
  });

  describe('prop: readOnly', () => {
    it('should render readOnly state on the input', async () => {
      await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('aria-readonly', 'true');
      expect(input).toHaveAttribute('readonly');
    });

    it('should expose aria-autocomplete="none" when readOnly', async () => {
      await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute('aria-autocomplete', 'none');
    });

    it('should open the popup from the input and the trigger when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('input'));
      expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(screen.getByTestId('trigger'));
      expect(await screen.findByRole('listbox')).not.toBe(null);
    });

    it('should browse the items with the arrow keys when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-highlighted');
      });
    });

    it('should not change the input value when typing while readOnly', async () => {
      const onInputValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onInputValueChange={onInputValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.type(input, 'a');

      expect(input).toHaveValue('');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('should set readOnly attribute on hidden input', async () => {
      await render(
        <Combobox.Root readOnly name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('readonly');
    });

    it('should prevent value changes when readOnly with items', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onValueChange={handleValueChange} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const itemA = screen.getByTestId('item-a');
      await user.click(itemA);

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not submit the form with Enter on a highlighted item when readOnly', async () => {
      const onSubmit = vi.fn();
      const { user } = await render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Combobox.Root readOnly>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByTestId('input'));
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{Enter}');

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should report arrow-key highlights as keyboard-driven when readOnly', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onItemHighlighted={onItemHighlighted}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Opening by pointer marks pointer activity, which the arrow key must clear.
      await user.click(screen.getByTestId('input'));
      await screen.findByRole('listbox');
      onItemHighlighted.mockClear();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenCalledWith(
          'a',
          expect.objectContaining({ reason: 'keyboard' }),
        );
      });
    });

    it('should not commit a value with Enter on a highlighted item when readOnly', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onValueChange={handleValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{Enter}');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(input).toHaveValue('');
    });
  });

  describe('prop: itemToStringLabel', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringLabel for input value synchronization', async () => {
      const { user } = await render(
        <Combobox.Root
          items={items}
          itemToStringLabel={(item: (typeof items)[number]) => item.country}
          itemToStringValue={(item: (typeof items)[number]) => item.code}
          defaultOpen
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: { country: string; code: string } }) => (
                      <Combobox.Item key={item.code} value={item}>
                        {item.country}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.click(screen.getByText('Canada'));
      expect(input).toHaveValue('Canada');
    });

    it('shows the label for a controlled object value not in items', async () => {
      const value = { country: 'Japan', code: 'JP' };

      await render(
        <Combobox.Root
          items={items}
          value={value}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('Japan');
    });
  });

  describe('prop: itemToStringValue', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringValue for form submission', async () => {
      await render(
        <Combobox.Root
          name="country"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          defaultValue={items[0]}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByDisplayValue('US'); // input[name="country"]
      expect(hiddenInput.tagName).toBe('INPUT');
      expect(hiddenInput).toHaveAttribute('name', 'country');
    });

    it('uses itemToStringValue for multiple selection form submission', async () => {
      const values = [items[0], items[1]];
      await render(
        <Combobox.Root
          name="countries"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          multiple
          defaultValue={values}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      values.forEach((value) => {
        const input = screen.getByDisplayValue(value.code);
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('name', 'countries');
      });
    });
  });

  describe('initial input value derivation', () => {
    it('derives input from defaultValue on first mount when unspecified', async () => {
      await render(
        <Combobox.Root defaultValue="apple">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('derives input from defaultValue on first mount with items prop', async () => {
      const items = [{ value: 'apple', label: 'Apple' }];
      await render(
        <Combobox.Root items={items} defaultValue={items[0]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('Apple');
    });

    it('derives input from controlled value on first mount when unspecified', async () => {
      await render(
        <Combobox.Root value="banana">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('banana');
    });

    it('defaultInputValue overrides derivation when provided', async () => {
      await render(
        <Combobox.Root defaultValue="apple" defaultInputValue="x">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('x');
    });

    it('inputValue overrides derivation when provided', async () => {
      await render(
        <Combobox.Root value="apple" inputValue="x">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('x');
    });

    it('multiple mode initial input remains empty', async () => {
      const items = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      await render(
        <Combobox.Root multiple items={items}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).toHaveValue('');
    });

    it('does not set input value for input-inside-popup pattern', async () => {
      await render(
        <Combobox.Root defaultOpen defaultValue="apple">
          <Combobox.Trigger>Trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).toHaveValue('');
    });
  });

  describe('input value synchronization', () => {
    it('updates derived input when controlled value changes externally', async () => {
      const items = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
      ];

      const { setProps } = await render(
        <Combobox.Root items={items} value={items[0]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      await setProps({ value: items[1] });

      expect(input).toHaveValue('Banana');
    });

    it('does not force-mount the list when controlled value changes externally (strict: %s)', async () => {
      const items = ['apple', 'banana'];
      const labels: Record<string, string> = {
        apple: 'Apple',
        banana: 'Banana',
      };

      const App = defineComponent(() => {
        const withItems = shallowRef<string | null>(null);
        const withoutItems = shallowRef<string | null>(null);

        return () => (
          <div>
            <button
              type="button"
              onClick={() => {
                withItems.value = 'banana';
                withoutItems.value = 'banana';
              }}
            >
              Set
            </button>
            <Combobox.Root
              items={items}
              value={withItems.value}
              onValueChange={(value: string | null) => {
                withItems.value = value;
              }}
              itemToStringLabel={(item: string) => labels[item]}
            >
              <Combobox.Input data-testid="items-input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {labels[item]}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Combobox.Root
              value={withoutItems.value}
              onValueChange={(value: string | null) => {
                withoutItems.value = value;
              }}
              itemToStringLabel={(item: string) => labels[item]}
            >
              <Combobox.Input data-testid="plain-input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="apple">Apple</Combobox.Item>
                      <Combobox.Item value="banana">Banana</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </div>
        );
      });

      const { user } = await render(<App />);

      expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);

      await user.click(screen.getByRole('button', { name: 'Set' }));

      expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);
      expect(screen.getByTestId('items-input')).toHaveValue('Banana');
      expect(screen.getByTestId('plain-input')).toHaveValue('Banana');
    });

    it('re-derives input when items array changes', async () => {
      const initialItems = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
      ];

      const { setProps } = await render(
        <Combobox.Root items={initialItems} value={initialItems[0]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      const nextItems = [
        { value: 'a', label: 'Apricot' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];

      await setProps({ items: nextItems, value: nextItems[0] });
      expect(input).toHaveValue('Apricot');

      const sameLengthDifferentItems = [
        { value: 'a', label: 'Ambrosia' },
        { value: 'b', label: 'Blue Java' },
        { value: 'c', label: 'Clementine' },
      ];

      await setProps({ items: sameLengthDifferentItems, value: sameLengthDifferentItems[0] });
      expect(input).toHaveValue('Ambrosia');
    });

    it('restores the selected label after a one-step clear and items reload', async () => {
      const itemToStringLabel = (item: string) => (item === 'apple' ? 'Apple' : item);
      const { setProps, user } = await render(
        <Combobox.Root items={['apple']} value="apple" itemToStringLabel={itemToStringLabel}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      await user.clear(input);
      expect(input).toHaveValue('');

      await setProps({ items: ['apple'] });

      expect(input).toHaveValue('Apple');
    });

    it('reports a single input value change when the controlled value changes', async () => {
      const onInputValueChange = vi.fn();
      const items = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];

      const { setProps } = await render(
        <Combobox.Root items={items} value={items[0]} onInputValueChange={onInputValueChange}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await setProps({ value: items[1] });

      expect(input).toHaveValue('Banana');
      expect(onInputValueChange).toHaveBeenCalledTimes(1);

      await setProps({ value: items[2] });

      expect(input).toHaveValue('Cherry');
      expect(onInputValueChange).toHaveBeenCalledTimes(2);

      await setProps({ value: items[0] });

      expect(input).toHaveValue('Apple');
      expect(onInputValueChange).toHaveBeenCalledTimes(3);
    });

    it('syncs again after a canceled sync to the same label', async () => {
      let cancelSync = false;

      const App = defineComponent(
        (props: { value: string }) => () => (
          <Combobox.Root
            items={['One', 'Two']}
            value={props.value}
            onInputValueChange={(_, eventDetails) => {
              if (cancelSync && eventDetails.reason === 'none') {
                eventDetails.cancel();
              }
            }}
          >
            <Combobox.Input />
          </Combobox.Root>
        ),
        { props: ['value'] },
      );

      const { setProps } = await render(<App value="One" />);
      const input = screen.getByRole<HTMLInputElement>('combobox');

      expect(input).toHaveValue('One');

      cancelSync = true;
      await setProps({ value: 'Two' });

      expect(input).toHaveValue('One');

      // The input already matches this label, so nothing is written and nothing observes a change.
      cancelSync = false;
      await setProps({ value: 'One' });

      expect(input).toHaveValue('One');

      await setProps({ value: 'Two' });

      expect(input).toHaveValue('Two');
    });

    it('reports a single input value change when the selection is remapped', async () => {
      const onInputValueChange = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef('Apple');

        return () => (
          <Combobox.Root
            items={['Apple', 'Banana', 'Cherry']}
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next === 'Banana' ? 'Cherry' : (next ?? '');
            }}
            onInputValueChange={onInputValueChange}
            defaultOpen
          >
            <Combobox.Input />
            <Combobox.List>
              {{
                item: ({ item }: { item: string }) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                ),
              }}
            </Combobox.List>
          </Combobox.Root>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByRole('option', { name: 'Banana' }));

      expect(screen.getByRole<HTMLInputElement>('combobox')).toHaveValue('Cherry');
      expect(
        onInputValueChange.mock.calls.map(([next, details]) => [next, details.reason]),
      ).toEqual([
        ['Banana', 'item-press'],
        ['Cherry', 'none'],
      ]);
    });

    it('re-syncs the input when the resolved label of an unchanged value changes', async () => {
      const App = defineComponent(
        (props: { itemToStringLabel: (value: string) => string }) => () => (
          <Combobox.Root items={['a', 'b']} value="b" itemToStringLabel={props.itemToStringLabel}>
            <Combobox.Input />
          </Combobox.Root>
        ),
        { props: ['itemToStringLabel'] },
      );

      const { setProps } = await render(<App itemToStringLabel={(value) => value} />);
      const input = screen.getByRole<HTMLInputElement>('combobox');

      expect(input).toHaveValue('b');

      await setProps({
        itemToStringLabel: (value: string) => (value === 'b' ? 'Banana' : value),
      });

      expect(input).toHaveValue('Banana');
    });

    it('restores derived input after items load asynchronously', async () => {
      const { setProps } = await render(
        <Combobox.Root items={[]} value="banana">
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('banana');

      await setProps({ items: ['apple', 'banana', 'bread'] });

      expect(input).toHaveValue('banana');

      await setProps({ items: ['banana'] });

      expect(input).toHaveValue('banana');
    });
  });

  describe.skipIf(isJSDOM)('reopening during the close animation', () => {
    it('shows every item when a controlled reopen interrupts a canceled mirrored-selection clear', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const App = defineComponent(() => {
        const open = shallowRef(false);
        const inputValue = shallowRef('');

        return () => (
          <>
            <style>{closeAnimationStyle}</style>
            <button
              type="button"
              data-testid="open"
              onClick={() => {
                open.value = true;
              }}
            >
              Open
            </button>
            <Combobox.Root
              items={['apple', 'apricot', 'banana']}
              open={open.value}
              onOpenChange={(next: boolean) => {
                open.value = next;
              }}
              onValueChange={(value: string | null) => {
                inputValue.value = value ?? '';
              }}
              inputValue={inputValue.value}
              onInputValueChange={(value, eventDetails) => {
                if (eventDetails.reason === REASONS.inputClear) {
                  eventDetails.cancel();
                } else {
                  inputValue.value = value;
                }
              }}
            >
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByTestId('open'));
      const input = await screen.findByTestId('input');
      await user.type(input, 'ap');
      const apple = await screen.findByRole('option', { name: 'apple' });

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.click(apple) });
      expect(popup).toHaveAttribute('data-ending-style');

      await user.click(screen.getByTestId('open'));
      await waitFor(() => expect(popup).toHaveAttribute('data-open'));
      // The popup removes the ending style in a frame after the reopen.
      await waitSingleFrame();
      await waitSingleFrame();
      expect(popup).not.toHaveAttribute('data-ending-style');

      expect(input).toHaveValue('apple');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    });

    it('keeps the typed filter when items change afterwards (input outside popup)', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const App = defineComponent(() => {
        const items = shallowRef(['apple', 'apricot', 'banana']);

        return () => (
          <>
            <style>{closeAnimationStyle}</style>
            <button
              type="button"
              data-testid="refetch"
              onClick={() => {
                items.value = [...items.value];
              }}
            >
              refetch
            </button>
            <Combobox.Root items={items.value}>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const input = screen.getByTestId('input');
      await user.type(input, 'app');

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      expect(popup).toHaveAttribute('data-ending-style');

      await user.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(input).toHaveValue('app');

      // A new `items` identity must not resync the input to the selected label while the
      // user's filter is still in it.
      await user.click(screen.getByTestId('refetch'));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
    });

    it('keeps filtering when typing reopens the popup (input outside popup)', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const { user } = await render(
        <>
          <style>{closeAnimationStyle}</style>
          <Combobox.Root items={['apple', 'apricot', 'banana']} defaultValue="apple">
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup" class="animation-test-popup">
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveValue('apple');

      await user.click(input);
      await user.keyboard('{Backspace}');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(1));

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      expect(popup).toHaveAttribute('data-ending-style');

      // Typing reopens the popup, so the keystroke's own "query changed" flag must survive
      // the reopen even when it restores the selected label exactly.
      await user.keyboard('e');
      await flushMicrotasks();

      expect(input).toHaveValue('apple');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(1));
    });

    it('does not re-emit a clear when closing again without typing (multiple, input outside popup)', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const onInputValueChange = vi.fn();

      const { user } = await render(
        <>
          <style>{closeAnimationStyle}</style>
          <Combobox.Root
            multiple
            items={['apple', 'apricot', 'banana']}
            onInputValueChange={onInputValueChange}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup" class="animation-test-popup">
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      expect(popup).toHaveAttribute('data-ending-style');

      // The close path already cleared the input, so nothing survives the reopen.
      await user.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(input).toHaveValue('');

      onInputValueChange.mockClear();

      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('keeps a keystroke typed into an empty input when items refresh synchronously', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const App = defineComponent(() => {
        const items = shallowRef(['apple', 'apricot', 'banana']);

        return () => (
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root
              items={items.value}
              defaultValue="apple"
              onInputValueChange={() => {
                items.value = [...items.value];
              }}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      const input = screen.getByTestId('input');
      expect(input).toHaveValue('apple');

      await user.click(input);
      await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
      expect(input).toHaveValue('');

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      expect(popup).toHaveAttribute('data-ending-style');

      // `ComboboxInput` sets the input value before requesting the open, so the reopen must not
      // judge survival from the stale empty value and let the `items` sync undo the keystroke.
      await user.keyboard('a');
      await flushMicrotasks();

      expect(input).toHaveValue('a');
    });

    it('releases the frozen query when controlled open reopens the popup', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const onInputValueChange = vi.fn();

      const App = defineComponent(() => {
        const open = shallowRef(false);

        return () => (
          <>
            <style>{closeAnimationStyle}</style>
            <button
              type="button"
              data-testid="reopen"
              onClick={() => {
                open.value = true;
              }}
            >
              Reopen
            </button>
            <Combobox.Root
              multiple
              items={['apple', 'apricot', 'banana']}
              open={open.value}
              onOpenChange={(next: boolean) => {
                open.value = next;
              }}
              onInputValueChange={onInputValueChange}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      });

      const { user } = await render(<App />);
      const input = screen.getByTestId('input');

      await user.type(input, 'app');

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      expect(popup).toHaveAttribute('data-ending-style');

      await user.click(screen.getByTestId('reopen'));

      await waitFor(() => expect(input).toHaveValue(''));
      expect(await screen.findByRole('option', { name: 'banana' })).not.toBe(null);

      onInputValueChange.mockClear();
      await user.keyboard('{Escape}');

      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('unfreezes filtering when a controlled open ignores the close request (multiple, input outside popup)', async () => {
      const { user } = await render(
        <Combobox.Root multiple items={['apple', 'apricot', 'banana']} open onOpenChange={() => {}}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup">
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'ap');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(2));

      // The close request clears the input and freezes the query for the exit animation,
      // but the consumer keeps the popup open, so the frozen query must stop filtering.
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(input).toHaveValue('');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(3));
    });

    it('opens blank when the input only mirrors the selection (single, input inside popup)', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const App = defineComponent(() => {
        const value = shallowRef<string | null>(null);
        const inputValue = shallowRef('');

        return () => (
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root
              items={['apple', 'apricot', 'banana']}
              value={value.value}
              onValueChange={(next: string | null) => {
                value.value = next;
                inputValue.value = next ?? '';
              }}
              inputValue={inputValue.value}
              onInputValueChange={(next: string) => {
                inputValue.value = next;
              }}
            >
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByTestId('trigger'));
      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ap');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(2));

      const apple = screen.getByRole('option', { name: 'apple' });
      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.click(apple) });
      expect(popup).toHaveAttribute('data-ending-style');

      // A consumer mirroring the selection into the popup input must not leave the reopened
      // list filtered by it: an interrupted close opens blank, same as a completed one.
      await user.click(screen.getByTestId('trigger'));

      const inputAfter = await screen.findByTestId('input');
      await waitFor(() => expect(inputAfter).toHaveValue(''));
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(3));
    });

    it('keeps an input value set in the same batch as a controlled reopen (input inside popup)', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const onInputValueChange = vi.fn();

      const App = defineComponent(() => {
        const open = shallowRef(false);
        const inputValue = shallowRef('');

        return () => (
          <>
            <style>{closeAnimationStyle}</style>
            <button
              type="button"
              data-testid="preset"
              onClick={() => {
                inputValue.value = 'banana';
                open.value = true;
              }}
            >
              preset
            </button>
            <Combobox.Root
              items={['apple', 'apricot', 'banana']}
              open={open.value}
              onOpenChange={(next: boolean) => {
                open.value = next;
              }}
              inputValue={inputValue.value}
              onInputValueChange={(value, eventDetails) => {
                onInputValueChange(value, eventDetails.reason);
                inputValue.value = value;
              }}
            >
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByTestId('trigger'));
      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ap');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(2));

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      expect(popup).toHaveAttribute('data-ending-style');

      onInputValueChange.mockClear();

      // The consumer's value never fed the frozen query, so the reopen cleanup must not
      // mistake it for leftover filter text and clear it.
      await user.click(screen.getByTestId('preset'));
      await flushMicrotasks();

      const inputAfter = await screen.findByTestId('input');
      expect(inputAfter).toHaveValue('banana');
      expect(onInputValueChange).not.toHaveBeenCalledWith('', 'input-clear');
    });

    it('shows every item when selection reopens the popup', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const { user } = await render(
        <>
          <style>{closeAnimationStyle}</style>
          <Combobox.Root items={['apple', 'apricot', 'banana']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup" class="animation-test-popup">
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'ap');
      const apple = await screen.findByRole('option', { name: 'apple' });

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.click(apple) });
      expect(popup).toHaveAttribute('data-ending-style');

      await user.click(screen.getByTestId('trigger'));

      expect(input).toHaveValue('apple');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    });
  });

  it('does not render aria-orientation on the listbox role', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.List>
          <Combobox.Item value="1">1</Combobox.Item>
        </Combobox.List>
      </Combobox.Root>,
    );

    // `listbox` is implicitly vertical.
    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-orientation');
  });

  describe('prop: grid', () => {
    it('sets grid roles when grid is enabled and rows are used', async () => {
      await render(
        <Combobox.Root grid defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                    <Combobox.Item value="6">6</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const grid = screen.getByRole('grid');
      expect(grid).not.toBe(null);
      const cells = screen.getAllByRole('gridcell');
      expect(cells).toHaveLength(6);
    });

    it('arrow keys navigate across rows and columns in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                    <Combobox.Item value="6">6</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('6'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('does not re-report the highlight on keys the grid does not handle', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="3">3</Combobox.Item>
                    <Combobox.Item value="4">4</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));
      onItemHighlighted.mockClear();

      // A modifier alone is not navigation; the grid navigator returns the unchanged index.
      await user.keyboard('{Shift}');
      await flushMicrotasks();
      expect(onItemHighlighted).not.toHaveBeenCalled();

      // A horizontal move is handled by the main-orientation path, once.
      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
      expect(onItemHighlighted).toHaveBeenCalledTimes(1);
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowLeft when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');

      expect(input.value).toBe('abc');
      expect(input.selectionStart).toBe(3);

      await user.keyboard('{ArrowLeft}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowRight when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');
      input.setSelectionRange(1, 1);

      expect(input.selectionStart).toBe(1);

      await user.keyboard('{ArrowRight}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('keeps grid navigation when autoHighlight surfaces an item before typing arrow keys', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid autoHighlight onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'a');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('mirrors horizontal grid navigation in RTL mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <DirectionProvider direction="rtl">
          <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                      <Combobox.Item value="3">3</Combobox.Item>
                    </Combobox.Row>
                    <Combobox.Row>
                      <Combobox.Item value="4">4</Combobox.Item>
                      <Combobox.Item value="5">5</Combobox.Item>
                      <Combobox.Item value="6">6</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </DirectionProvider>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('supports uneven rows navigation', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="6">6</Combobox.Item>
                    <Combobox.Item value="7">7</Combobox.Item>
                    <Combobox.Item value="8">8</Combobox.Item>
                    <Combobox.Item value="9">9</Combobox.Item>
                    <Combobox.Item value="10">10</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      // Down from last col (3) to shorter row should clamp to last item (5)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      // Up from clamped item (5) should return to same column in previous row (2)
      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      // From 2, move down to 5 (same column), then down to 7 in the longer row
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('7'));

      // Left within last row goes to 6, up to first col in previous row (4)
      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('6'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('4'));
    });

    it('supports uneven rows navigation within groups', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                      <Combobox.Item value="3">3</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="4">4</Combobox.Item>
                      <Combobox.Item value="5">5</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="6">6</Combobox.Item>
                      <Combobox.Item value="7">7</Combobox.Item>
                      <Combobox.Item value="8">8</Combobox.Item>
                      <Combobox.Item value="9">9</Combobox.Item>
                      <Combobox.Item value="10">10</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('7'));
    });

    it('does not render aria-orientation on the grid role', async () => {
      await render(
        <Combobox.Root grid defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // The grid role does not support aria-orientation (axe: aria-allowed-attr).
      const grid = screen.getByRole('grid');
      expect(grid).not.toHaveAttribute('aria-orientation');
    });

    it('renders groups with the rowgroup role', async () => {
      await render(
        <Combobox.Root grid defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group>
                    <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // `grid` may only own `row`/`rowgroup` elements (axe: aria-required-children),
      // and `row` must be owned by `grid`, `rowgroup`, or `treegrid` (axe: aria-required-parent).
      expect(screen.queryByRole('group')).toBeNull();
      expect(screen.getByRole('rowgroup')).toHaveAccessibleName('Fruits');
    });
  });

  describe('prop: multiple', () => {
    it('"single" selects and closes, then reopens with selection focused', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                  <Combobox.Item value="c">c</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(screen.getByRole('option', { name: 'b' }));
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('b');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true');
    });

    it('"single" keeps the popup open when selection is canceled', async () => {
      const onValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { user } = await render(
        <Combobox.Root defaultOpen onValueChange={onValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(screen.getByRole('option', { name: 'b' }));

      // The change was canceled, so the value never committed and the popup stays open.
      expect(onValueChange).toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveValue('b');
    });

    it('"multiple" clears uncontrolled input after select when filtering', async () => {
      const { user } = await render(
        <Combobox.Root multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();
      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      // After selecting while filtering, uncontrolled input clears
      expect(input).toHaveValue('');
    });

    it('keeps the active item when the post-selection input clear is canceled', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const onInputValueChange = vi.fn((_value, details: Combobox.Root.ChangeEventDetails) => {
        if (details.reason === REASONS.inputClear) {
          details.cancel();
        }
      });

      const { user } = await render(
        <Combobox.Root multiple defaultOpen items={items} onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      const apple = await screen.findByRole('option', { name: 'apple' });
      await fireEvent.mouseMove(apple, { pointerType: 'mouse', movementX: 1 });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      const ariaMutations: MutationRecord[] = [];
      const observer = new MutationObserver((records) => ariaMutations.push(...records));
      observer.observe(input, {
        attributes: true,
        attributeFilter: ['aria-activedescendant'],
      });
      onTestFinished(() => observer.disconnect());

      await fireEvent.click(apple);
      await flushMicrotasks();

      expect(onInputValueChange.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
      expect(input).toHaveValue('app');
      expect(apple).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      expect(ariaMutations).toHaveLength(0);
    });

    it('keeps the filter text when the "item-press" close is canceled (input outside popup)', async () => {
      const { user } = await render(
        <Combobox.Root
          multiple
          onOpenChange={(open, eventDetails) => {
            if (!open && eventDetails.reason === REASONS.itemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(input).toHaveValue('');
    });

    it('marks the close-path clear as an item press only when an item press closed the popup (input outside popup)', async () => {
      const onInputValueChange = vi.fn();

      const { user } = await render(
        <Combobox.Root multiple onInputValueChange={onInputValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      onInputValueChange.mockClear();

      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('');
      expect(onInputValueChange.mock.calls.find((call) => call[0] === '')?.[1].isItemPress).toBe(
        true,
      );

      await user.type(input, 'app');
      onInputValueChange.mockClear();

      // Closing with the keyboard clears the same way, but no item was pressed.
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(input).toHaveValue('');
      expect(onInputValueChange.mock.calls.find((call) => call[0] === '')?.[1].isItemPress).toBe(
        false,
      );
    });

    it('keeps the filter text when the selection clear is canceled (input inside popup)', async () => {
      const { user } = await render(
        <Combobox.Root
          multiple
          defaultOpen
          onInputValueChange={(value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    it('keeps the filter text in an inline list when the selection clear is canceled', async () => {
      const { user } = await render(
        <Combobox.Root
          multiple
          inline
          open
          onInputValueChange={(value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            <Combobox.Item value="apple">apple</Combobox.Item>
            <Combobox.Item value="apricot">apricot</Combobox.Item>
            <Combobox.Item value="banana">banana</Combobox.Item>
          </Combobox.List>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('still clears the kept filter text once the popup closes', async () => {
      const { user } = await render(
        <Combobox.Root
          multiple
          onInputValueChange={(value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');

      // The cleanup clear that runs after the popup closes doesn't carry `isItemPress`, so the
      // recipe doesn't cancel it and the next open starts with a fresh filter.
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('');
    });

    it('clears the input with the "input-clear" reason and the item click event on pointer selection', async () => {
      const onInputValueChange = vi.fn();

      const { user } = await render(
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.type(screen.getByTestId('input'), 'app');
      onInputValueChange.mockClear();

      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(onInputValueChange).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ reason: REASONS.inputClear }),
      );
      expect(onInputValueChange.mock.lastCall?.[1].event?.type).toBe('click');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it('clears the input with the "input-clear" reason and the originating keydown event on keyboard selection', async () => {
      const onInputValueChange = vi.fn();

      const { user } = await render(
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await screen.findByRole('option', { name: 'apple' });

      await user.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute('data-highlighted'),
      );

      onInputValueChange.mockClear();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(onInputValueChange).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ reason: REASONS.inputClear }),
      );
      // Keyboard activation synthesizes a click on the highlighted item, but the details carry the
      // originating keydown so consumers see the real user gesture.
      expect(onInputValueChange.mock.lastCall?.[1].event?.type).toBe('keydown');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it('keeps the filter text when a drag-select release commits the selection', async () => {
      const onInputValueChange = vi.fn((_value, eventDetails: Combobox.Root.ChangeEventDetails) => {
        if (eventDetails.isItemPress) {
          eventDetails.cancel();
        }
      });

      const { user } = await render(
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      const apple = await screen.findByRole('option', { name: 'apple' });
      await fireEvent.mouseMove(apple, { pointerType: 'mouse', movementX: 1 });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      // Press starts outside the item (drag-select), so the commit happens on mouseup.
      await fireEvent.mouseUp(apple, { button: 0 });
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(apple).toHaveAttribute('aria-selected', 'true');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it.skipIf(isJSDOM)(
      'clears the pending filter with the "input-clear" reason when reopening interrupts the close animation',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const onInputValueChange = vi.fn(
          (_value, eventDetails: Combobox.Root.ChangeEventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          },
        );

        const { user } = await render(
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root
              multiple
              items={['apple', 'apricot', 'banana']}
              onInputValueChange={onInputValueChange}
            >
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>,
        );

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        const input = await screen.findByTestId('input');
        await waitFor(() => expect(input).toHaveFocus());

        await user.type(input, 'app');

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');

        const callsBeforeReopen = onInputValueChange.mock.calls.length;
        await user.click(trigger);

        await waitFor(() => expect(screen.getByTestId('input')).toHaveValue(''));

        const cleanupCall = onInputValueChange.mock.calls
          .slice(callsBeforeReopen)
          .find((call) => call[0] === '');
        expect(cleanupCall).not.toBe(undefined);
        expect(cleanupCall?.[1].reason).toBe(REASONS.inputClear);
        expect(cleanupCall?.[1].isItemPress).toBe(undefined);
        // The synthetic placeholder event proves cleanup clears never carry the reopening gesture.
        expect(cleanupCall?.[1].event.type).toBe('vase-ui');
      },
    );

    it.skipIf(isJSDOM)(
      'releases the frozen query when reopening during the close animation with the input outside the popup',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const { user } = await render(
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root multiple items={['apple', 'apricot', 'banana']}>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>,
        );

        const input = screen.getByTestId('input');
        await user.type(input, 'app');

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');

        await user.click(screen.getByTestId('trigger'));

        await waitFor(() => expect(input).toHaveValue(''));
        expect(await screen.findByRole('option', { name: 'banana' })).not.toBe(null);
      },
    );

    it('does not close popup when filtering with input inside popup in multiple mode', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const { user } = await render(
        <Combobox.Root multiple items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await user.type(input, 'app');
      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      expect(input).toHaveValue('');
    });

    it('keeps the popup input focused through keyboard selection and restores the last selection', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const { user } = await render(
        <Combobox.Root multiple items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await user.type(input, 'ban');
      await user.keyboard('{ArrowDown}{Enter}');

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('');
      expect(trigger).toHaveTextContent('banana');
      expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();

      await user.click(trigger);

      const selectedOption = await screen.findByRole('option', { name: 'banana' });
      expect(screen.getByTestId('input')).toHaveValue('');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(selectedOption).toHaveAttribute('data-highlighted'));
    });

    it.skipIf(isJSDOM)(
      'keeps filtered popup content stable when input changes during the close animation',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const { user } = await render(
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root multiple items={['apple', 'apricot', 'banana']}>
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>,
        );

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'ap');

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');

        await user.clear(input);

        expect(screen.getByText('apple')).not.toBe(null);
        expect(screen.getByText('apricot')).not.toBe(null);
        expect(screen.queryByText('banana')).toBe(null);
      },
    );

    it.skipIf(isJSDOM)(
      'does not emit another clear when controlled input is already empty on interrupted close',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const onInputValueChange = vi.fn();

        const Test = defineComponent(() => {
          const inputValue = shallowRef('');

          return () => (
            <>
              <style>{closeAnimationStyle}</style>
              <Combobox.Root
                multiple
                items={['apple', 'banana']}
                inputValue={inputValue.value}
                onInputValueChange={(value: string) => {
                  onInputValueChange(value);
                  inputValue.value = value;
                }}
                onOpenChange={(open: boolean) => {
                  if (!open) {
                    inputValue.value = '';
                  }
                }}
              >
                <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup data-testid="popup" class="animation-test-popup">
                      <Combobox.Input data-testid="input" />
                      <Combobox.List>
                        {{
                          item: ({ item }: { item: string }) => (
                            <Combobox.Item key={item} value={item}>
                              {item}
                            </Combobox.Item>
                          ),
                        }}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            </>
          );
        });

        const { user } = await render(<Test />);
        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);
        await user.type(await screen.findByTestId('input'), 'zz');

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');
        expect(screen.getByTestId('input')).toHaveValue('');

        const callsBeforeReopen = onInputValueChange.mock.calls.length;

        await user.click(trigger);

        await waitFor(() => {
          expect(popup).toHaveAttribute('data-open');
        });
        // The popup removes the ending style in a frame after the reopen.
        await waitSingleFrame();
        await waitSingleFrame();
        expect(popup).not.toHaveAttribute('data-ending-style');
        expect(screen.getByTestId('input')).toHaveValue('');
        expect(onInputValueChange).toHaveBeenCalledTimes(callsBeforeReopen);
      },
    );

    it('"multiple" clears typed input on close when no selection made', async () => {
      const onInput = vi.fn();
      const { user } = await render(
        <Combobox.Root multiple defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('');
      expect(onInput.mock.lastCall?.[0]).toBe('');
      expect(onInput.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
    });

    it('does not clear popup input after canceled multiple value changes', async () => {
      const onInputValueChange = vi.fn();
      const onValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });

      const { user } = await render(
        <Combobox.Root
          multiple
          onInputValueChange={onInputValueChange}
          onValueChange={onValueChange}
        >
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByText('Open'));

      const input = await screen.findByTestId('input');
      // Wait for the popup to finish opening so the input is interactive (the positioner is
      // `inert` until then).
      await screen.findByRole('option', { name: 'apple' });
      await user.type(input, 'app');
      onInputValueChange.mockClear();

      await user.click(screen.getByRole('option', { name: 'apple' }));

      expect(onValueChange).toHaveBeenCalled();
      expect(input).toHaveValue('app');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('"single" clears typed input on close when no selection made (input outside popup)', async () => {
      const onInput = vi.fn();
      const { user } = await render(
        <Combobox.Root defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'zz');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(input).toHaveValue('');
      expect(onInput.mock.lastCall?.[0]).toBe('');
      expect(onInput.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
    });
  });

  describe('prop: filter', () => {
    it('uses custom filter to narrow results', async () => {
      const items = ['alpha', 'beta', 'alphabet', 'alpine'];
      const startsWith = (item: string, q: string) => item.toLowerCase().startsWith(q);

      const { user } = await render(
        <Combobox.Root items={items} filter={(item, q) => startsWith(String(item), q)}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'alp');
      await flushMicrotasks();

      // Only beta should be filtered out
      expect(screen.queryByText('beta')).toBe(null);
      expect(screen.queryByText('alpha')).not.toBe(null);
      expect(screen.queryByText('alphabet')).not.toBe(null);
      expect(screen.queryByText('alpine')).not.toBe(null);
    });

    it('resets filtered results after selecting when using a custom search stringifier', async () => {
      type Movie = { id: number; english: string; romaji: string };
      const movies: Movie[] = [
        { id: 1, english: 'Spirited Away', romaji: 'Sen to Chihiro no Kamikakushi' },
        { id: 2, english: 'My Neighbor Totoro', romaji: 'Tonari no Totoro' },
        { id: 3, english: 'Princess Mononoke', romaji: 'Mononoke Hime' },
      ];

      const stringifyMovie = (movie: Movie | null) =>
        movie ? `${movie.english} ${movie.romaji}` : '';

      const MultilingualFilterCombobox = defineComponent(() => {
        const value = shallowRef<Movie | null>(null);
        const { contains } = Combobox.useFilter(() => ({ value: value.value }));

        const filter = (item: Movie | null, query: string) => {
          if (!item) {
            return false;
          }
          return contains(item, query, stringifyMovie);
        };

        return () => (
          <Combobox.Root
            items={movies}
            value={value.value}
            onValueChange={(next: Movie | null) => {
              value.value = next;
            }}
            filter={filter}
            itemToStringLabel={(movie: Movie | null) => movie?.english ?? ''}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item: movie }: { item: Movie }) => (
                        <Combobox.Item key={movie.id} value={movie}>
                          {movie.english}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      });

      const { user } = await render(<MultilingualFilterCombobox />);
      const input = screen.getByRole('combobox');

      await user.click(input);
      await screen.findByRole('listbox');

      await user.type(input, 'tonari');

      expect(screen.queryByRole('option', { name: 'Spirited Away' })).toBe(null);

      // Vue skips the listener of the item that the query mounted, in the millisecond of its mount.
      await waitForLaterMillisecond();
      await user.click(screen.getByRole('option', { name: 'My Neighbor Totoro' }));

      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spirited Away' })).not.toBe(null);
      });
    });
  });

  describe('prop: filteredItems', () => {
    it('uses filteredItems when items prop is omitted', async () => {
      const fruits = ['Apple', 'Banana', 'Cherry'];

      const FilteredItemsOnlyCombobox = defineComponent(() => {
        const value = shallowRef<string | null>(null);

        return () => (
          <Combobox.Root
            filteredItems={fruits}
            value={value.value}
            onValueChange={(next: string | null) => {
              value.value = next;
            }}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      });

      const { user } = await render(<FilteredItemsOnlyCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await screen.findByRole('listbox');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
      });
    });

    it('highlights the externally filtered item order when filtering reorders items', async () => {
      const fruits = ['Apple', 'Banana', 'Zucchini'];
      const onItemHighlighted = vi.fn();

      const ReorderingFilteredItemsCombobox = defineComponent(() => {
        const input = shallowRef('');
        const filteredItems = computed(() => {
          if (input.value.length > 0) {
            return [...fruits].reverse();
          }
          return fruits;
        });

        return () => (
          <Combobox.Root
            autoHighlight
            filteredItems={filteredItems.value}
            inputValue={input.value}
            onInputValueChange={(next: string) => {
              input.value = next;
            }}
            onItemHighlighted={onItemHighlighted}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      });

      const { user } = await render(<ReorderingFilteredItemsCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      onItemHighlighted.mockClear();

      await user.type(input, 'a');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });

      const [highlightedValue] = onItemHighlighted.mock.lastCall ?? [];
      expect(highlightedValue).toBe('Zucchini');
    });

    it('opens a reordered external list at the selected value in rendered-list coordinates', async () => {
      const fruits = ['Apple', 'Banana', 'Cherry'];
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Combobox.Root
          items={fruits}
          filteredItems={['Cherry', 'Apple']}
          multiple
          defaultValue={['Apple']}
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByRole('combobox'));

      const apple = await screen.findByRole('option', { name: 'Apple' });
      const cherry = screen.getByRole('option', { name: 'Cherry' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
      expect(cherry).not.toHaveAttribute('data-highlighted');
      expect(onItemHighlighted.mock.lastCall?.[0]).toBe('Apple');
    });

    it('resets an initially empty external result when opening a grouped selection', async () => {
      const groups = [
        { value: 'Fruits', items: ['Apple', 'Banana'] },
        { value: 'Vegetables', items: ['Carrot'] },
      ];

      const { user } = await render(
        <Combobox.Root items={groups} filteredItems={[]} defaultValue="Banana">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item: group }: { item: (typeof groups)[number] }) => (
                      <Combobox.Group key={group.value} items={group.items}>
                        <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                        <Combobox.Collection>
                          {({ item }: { item: string }) => (
                            <Combobox.Item key={item} value={item}>
                              {item}
                            </Combobox.Item>
                          )}
                        </Combobox.Collection>
                      </Combobox.Group>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('input')).toHaveValue('Banana');

      await user.click(screen.getByTestId('input'));

      expect(await screen.findAllByRole('option')).toHaveLength(3);
      expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    // Async search keeps showing the previous results while the user types.
    it('does not re-render the list while typing when the external result is unchanged', async () => {
      const items = ['apple', 'banana', 'cherry'];
      const renderItem = vi.fn();

      const { user } = await render(
        <ComboboxRootRenders items={items} onItemRender={renderItem} />,
      );

      // The list renders again while the popup gets its first position.
      await waitForPositioned(screen.getByTestId('positioner'));
      await flushMicrotasks();
      expect(renderItem).toHaveBeenCalled();
      renderItem.mockClear();

      const input = screen.getByTestId('input');
      await user.type(input, 'b');
      await waitFor(() => expect(input).toHaveValue('b'));

      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect(renderItem).not.toHaveBeenCalled();
    });
  });

  describe('prop: openOnInputClick', () => {
    it('keeps the popup open on a second input click by default', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Click input again should not toggle closed automatically
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
    });

    it('does not open on input click when false, but opens on typing', async () => {
      const { user } = await render(
        <Combobox.Root openOnInputClick={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
  });

  describe('scroll reset on input value change', () => {
    const manyItems = Array.from({ length: 50 }, (_, index) => `item-${index}`);

    it.skipIf(isJSDOM)(
      'resets the list scroll position to the top when the query changes',
      async () => {
        const filteringItems = Array.from({ length: 50 }, (_, index) =>
          index < 25 ? `alpha-${index}` : `beta-${index - 25}`,
        );

        const { user } = await render(
          <Combobox.Root items={filteringItems}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List style={{ maxHeight: '100px', overflowY: 'auto' }}>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;
        expect(list.scrollTop).toBeGreaterThan(0);

        // Remove the current first item while keeping enough matches for the list to scroll.
        await user.type(input, 'b');

        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)(
      'resets manually filtered children without deferring the reset until hover',
      async () => {
        const filteringItems = Array.from({ length: 50 }, (_, index) =>
          index < 25 ? `alpha-${index}` : `beta-${index - 25}`,
        );

        const ManuallyFilteredCombobox = defineComponent(() => {
          const inputValue = shallowRef('');
          const visibleItems = computed(() =>
            filteringItems.filter((item) => item.startsWith(inputValue.value)),
          );

          return () => (
            <Combobox.Root
              inputValue={inputValue.value}
              onInputValueChange={(next: string) => {
                inputValue.value = next;
              }}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List style={{ maxHeight: '100px', overflowY: 'auto' }}>
                      {visibleItems.value.map((item) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ))}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        });

        const { user } = await render(<ManuallyFilteredCombobox />);
        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;
        expect(list.scrollTop).toBeGreaterThan(0);

        await user.type(input, 'b');

        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });

        // A later highlight must not consume a typed-input reset that should already be cleared.
        list.scrollTop = 40;
        const visibleOption = screen.getByRole('option', { name: 'beta-5' });
        await fireEvent.mouseMove(visibleOption, { movementX: 1 });
        await waitFor(() => {
          expect(visibleOption).toHaveAttribute('data-highlighted');
        });
        expect(list.scrollTop).toBe(40);
      },
    );

    it.skipIf(isJSDOM)(
      'resets the scroll position of a scrollable wrapper around the list',
      async () => {
        const { user } = await render(
          <Combobox.Root items={manyItems}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <div data-testid="viewport" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                    <Combobox.List style={{ overflowY: 'auto' }}>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </div>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        await user.click(input);

        const viewport = screen.getByTestId('viewport');
        viewport.scrollTop = 40;
        expect(viewport.scrollTop).toBeGreaterThan(0);

        await user.type(input, 'item-1');

        await waitFor(() => {
          expect(viewport.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)('skips clipping ancestors when finding the scroll container', async () => {
      const { user } = await render(
        <Combobox.Root items={manyItems}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <div data-testid="viewport" style={{ height: '100px', overflowY: 'auto' }}>
                  <div style={{ overflowY: 'clip' }}>
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </div>
                </div>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      const viewport = screen.getByTestId('viewport');
      viewport.scrollTop = 40;
      expect(viewport.scrollTop).toBeGreaterThan(0);

      await user.type(input, 'item-1');

      await waitFor(() => {
        expect(viewport.scrollTop).toBe(0);
      });
    });

    it.skipIf(isJSDOM)(
      'keeps the auto-highlighted first item in view after the query changes',
      async () => {
        const { user } = await render(
          <Combobox.Root items={manyItems} autoHighlight>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List style={{ maxHeight: '100px', overflowY: 'auto' }}>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;

        await user.type(input, 'item-1');

        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)(
      'resets the scroll container when filtering reorders retained items',
      async () => {
        const items = Array.from({ length: 10 }, (_, index) => `item-${index}`);

        const ReorderingCombobox = defineComponent(() => {
          const inputValue = shallowRef('');
          const filteredItems = computed(() =>
            inputValue.value === '' ? items : [...items].reverse(),
          );

          return () => (
            <Combobox.Root
              filteredItems={filteredItems.value}
              inputValue={inputValue.value}
              onInputValueChange={(next: string) => {
                inputValue.value = next;
              }}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List style={{ maxHeight: '60px', overflowY: 'auto' }}>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item} style={{ height: '24px' }}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        });

        const { user } = await render(<ReorderingCombobox />);
        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;
        expect(list.scrollTop).toBeGreaterThan(0);

        await user.type(input, 'x');

        await waitFor(() => {
          expect(screen.getAllByRole('option')[0]).toHaveTextContent('item-9');
        });
        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)(
      'resets only the nearest scrollable wrapper when composed in a scrollable dialog',
      async () => {
        const { user } = await render(
          <Combobox.Root items={manyItems} inline open>
            <div
              role="dialog"
              data-testid="dialog"
              style={{ height: '80px', overflowY: 'auto', overflowAnchor: 'none' }}
            >
              <div style={{ height: '100px' }} />
              <Combobox.Input data-testid="input" />
              <div data-testid="viewport" style={{ height: '100px', overflowY: 'auto' }}>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </div>
            </div>
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        const dialog = screen.getByTestId('dialog');
        const viewport = screen.getByTestId('viewport');
        await user.click(input);
        // Firefox scrolls the container once more in the frame after the click. That scroll would
        // replace the position that the case sets next.
        await waitSingleFrame();
        dialog.scrollTop = 150;
        viewport.scrollTop = 40;
        const dialogScrollTop = dialog.scrollTop;
        expect(dialog.scrollTop).toBeGreaterThan(0);
        expect(viewport.scrollTop).toBeGreaterThan(0);

        await user.keyboard('item-1');

        await waitFor(() => {
          expect(viewport.scrollTop).toBe(0);
        });
        expect(dialog.scrollTop).toBe(dialogScrollTop);
      },
    );

    it.skipIf(isJSDOM)('does not reset a surrounding dialog', async () => {
      const DialogWithPortal = defineComponent(() => {
        const dialogElement = shallowRef<HTMLElement | null>(null);

        return () => (
          <Combobox.Root items={manyItems} open>
            <div
              ref={(element) => {
                dialogElement.value = element as HTMLElement | null;
              }}
              role="dialog"
              data-testid="dialog"
              style={{ height: '80px', overflowY: 'auto', overflowAnchor: 'none' }}
            >
              <div style={{ height: '100px' }} />
              <Combobox.Input data-testid="input" />
              <Combobox.Portal container={dialogElement}>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </div>
          </Combobox.Root>
        );
      });

      const { user } = await render(<DialogWithPortal />);

      const input = screen.getByTestId('input');
      const dialog = screen.getByTestId('dialog');
      await user.click(input);
      expect(dialog).toContainElement(screen.getByRole('listbox'));
      dialog.scrollTop = dialog.scrollHeight;
      const dialogScrollTop = dialog.scrollTop;
      expect(dialogScrollTop).toBeGreaterThan(0);

      await user.keyboard('item-1');

      expect(dialog.scrollTop).toBe(dialogScrollTop);
    });
  });

  describe('prop: autoHighlight', () => {
    it('keeps the first highlight when typing opens a kept-mounted list', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'apricot', 'banana']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal keepMounted>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      input.focus();
      await flushMicrotasks();
      await user.keyboard('a');

      const apple = await screen.findByRole('option', { name: 'apple' });
      // The highlight must survive the list opening.
      await waitSingleFrame();
      await flushMicrotasks();
      expect(apple).toHaveAttribute('data-highlighted');
    });

    describe('asynchronous items', () => {
      it('keeps a hovered item highlighted when individually rendered items arrive', async () => {
        const ChildrenCombobox = defineComponent({
          props: { results: { type: Array as PropType<string[]>, required: true } },
          setup(props) {
            return () => (
              <Combobox.Root autoHighlight>
                <Combobox.Input />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        {props.results.map((item) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ))}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            );
          },
        });

        const { user, setProps } = await render(<ChildrenCombobox results={[]} />);
        await user.type(screen.getByRole('combobox'), 'a');
        await setProps({ results: ['a1', 'a2', 'a3'] });

        const option = screen.getByRole('option', { name: 'a3' });
        await user.hover(option);
        await moveOver(option);
        expect(option).toHaveAttribute('data-highlighted');
      });

      it('highlights the first result when typing filters out individually rendered items', async () => {
        const FilteredCombobox = defineComponent(() => {
          const query = shallowRef('');
          const fruits = computed(() =>
            ['apple', 'banana', 'blackberry', 'blueberry'].filter((fruit) =>
              fruit.includes(query.value),
            ),
          );

          return () => (
            <Combobox.Root
              autoHighlight
              onInputValueChange={(next: string) => {
                query.value = next;
              }}
            >
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {fruits.value.map((fruit) => (
                        <Combobox.Item key={fruit} value={fruit}>
                          {fruit}
                        </Combobox.Item>
                      ))}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        });

        const { user } = await render(<FilteredCombobox />);
        const input = screen.getByRole('combobox');
        await user.type(input, 'b');
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('option', { name: 'blackberry' })).toHaveAttribute(
          'data-highlighted',
        );

        await user.type(input, 'l');
        const option = screen.getByRole('option', { name: 'blackberry' });
        expect(option).toHaveAttribute('data-highlighted');
        expect(input).toHaveAttribute('aria-activedescendant', option.id);
      });
    });

    it('does not auto-highlight on initial open when no selection', async () => {
      await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('shows the selected item as selected on initial open (no active highlight)', async () => {
      await render(
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          defaultValue="banana"
          autoHighlight
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const banana = screen.getByRole('option', { name: 'banana' });

      expect(banana).toHaveAttribute('aria-selected', 'true');
      // Highlight is applied only after filtering begins
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('highlights the first matching item after typing (single mode)', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'ch');

      const cherry = await screen.findByRole('option', { name: 'cherry' });
      expect(input).toHaveAttribute('aria-activedescendant', cherry.id);
    });

    it('highlights the first matching item after IME composition', async () => {
      await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight openOnInputClick={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: 'ch' } });
      await fireEvent.compositionEnd(input, { data: 'ch' });

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const cherry = await screen.findByRole('option', { name: 'cherry' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', cherry.id));
    });

    it('highlights the first matching item for a static list without the items prop', async () => {
      const { user } = await render(
        <Combobox.Root autoHighlight>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">alpha</Combobox.Item>
                  <Combobox.Item value="alphabet">alphabet</Combobox.Item>
                  <Combobox.Item value="beta">beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'al');

      const alpha = screen.getByRole('option', { name: 'alpha' });
      await waitFor(() => expect(alpha).toHaveAttribute('data-highlighted'));
      expect(input).toHaveAttribute('aria-activedescendant', alpha.id);

      await user.type(input, ' ');
      expect(alpha).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', alpha.id);
    });

    it('keeps gridcell typeahead active across Space in row mode without selecting', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root autoHighlight grid onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="new-york">new york</Combobox.Item>
                    <Combobox.Item value="new-jersey">new jersey</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="old-town">old town</Combobox.Item>
                    <Combobox.Item value="other">other</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'new');

      const newYork = screen.getByRole('gridcell', { name: 'new york' });
      await waitFor(() => expect(newYork).toHaveAttribute('data-highlighted'));
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);

      await user.type(input, ' ');
      expect(newYork).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);
      expect(input).toHaveValue('new ');
      expect(onValueChange.mock.calls.length > 0).toBe(false);
    });

    it('does not run follow-up state changes after canceled input value changes', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const onInputValueChange = vi.fn(
        (_value: string, details: Combobox.Root.ChangeEventDetails) => {
          details.cancel();
        },
      );

      const { user } = await render(
        <Combobox.Root
          defaultValue="apple"
          openOnInputClick={false}
          onInputValueChange={onInputValueChange}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.clear(input);

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);

      onInputValueChange.mockClear();
      onOpenChange.mockClear();

      await user.type(input, 'b');

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('retains highlight when query is cleared back to empty', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'a');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    });

    it('retains highlight when clearing the query with input-change behavior', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'ban');
      await screen.findByRole('option', { name: 'banana' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const highlightedBefore = input.getAttribute('aria-activedescendant');
      expect(highlightedBefore).not.toBe(null);

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    });

    it('highlights the first matching item after typing (multiple mode)', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} multiple autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'ba');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const activeId = input.getAttribute('aria-activedescendant');
      expect(activeId).not.toBe(null);
      const activeEl = document.getElementById(activeId!);
      expect(activeEl?.textContent).toBe('banana');
    });

    it('clears highlight after removing the highlighted chip while filtering (multiple mode)', async () => {
      const { user } = await render(
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          multiple
          autoHighlight
          defaultOpen
          defaultValue={['apple']}
        >
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: string[] }) => (
                  <>
                    {value.map((item) => (
                      <Combobox.Chip key={item}>
                        {item}
                        <Combobox.ChipRemove aria-label={`Remove ${item}`} />
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.type(input, 'a');
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));

      await user.click(screen.getByRole('button', { name: 'Remove apple', hidden: true }));

      await flushMicrotasks();
      expect(input.getAttribute('aria-activedescendant')).toBe(null);
    });

    it('keeps the active item highlighted after clearing the last selected value', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
        { id: 'rb', value: 'Ruby' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof items)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.value}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      await user.type(input, 'pyth');
      // Vue skips the listener of the item that the query mounted, in the millisecond of its mount.
      await waitForLaterMillisecond();
      await user.click(screen.getByRole('option', { name: 'Python' }));

      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);

      input.focus();
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.hover(screen.getByRole('option', { name: 'JavaScript' }));
      await moveOver(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.hover(screen.getByRole('option', { name: 'TypeScript' }));
      await moveOver(screen.getByRole('option', { name: 'TypeScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await user.hover(pythonOption);
      await moveOver(pythonOption);
      await user.click(pythonOption);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', pythonOption.id);
      });

      await user.keyboard('{ArrowDown}');
      const rubyOption = screen.getByRole('option', { name: 'Ruby' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', rubyOption.id);
      });
    });

    it('does not shift highlight to the previous selected item on Enter deselect', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple defaultValue={[items[0], items[1]]}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof items)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.value}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await moveOver(typeScriptOption);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      expect(typeScriptOption).toHaveAttribute('aria-selected', 'true');

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(typeScriptOption).toHaveAttribute('aria-selected', 'false');
      });
      expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
    });

    it('continues ArrowDown navigation from the Enter-selected item (multiple mode)', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple>
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: (typeof items)[number][] }) => (
                  <>
                    {value.map((item) => (
                      <Combobox.Chip key={item.id} aria-label={item.value}>
                        {item.value}
                        <Combobox.ChipRemove aria-label={`Remove ${item.value}`} />
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof items)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.value}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await moveOver(typeScriptOption);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{ArrowDown}');

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', pythonOption.id);
      });
    });

    it('clears active highlight when removing the highlighted chip item', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple defaultValue={[items[0], items[1]]}>
          <Combobox.Chips>
            <Combobox.Value
              v-slots={{
                default: ({ value }: { value: (typeof items)[number][] }) => (
                  <>
                    {value.map((item) => (
                      <Combobox.Chip key={item.id} aria-label={item.value}>
                        {item.value}
                        <Combobox.ChipRemove aria-label={`Remove ${item.value}`} />
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input data-testid="input" />
                  </>
                ),
              }}
            />
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof items)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.value}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });

      const highlightedOption = document.getElementById(
        input.getAttribute('aria-activedescendant')!,
      );
      const highlightedLabel = highlightedOption?.textContent;
      expect(highlightedLabel).not.toBe(null);

      await user.click(
        screen.getByRole('button', { name: `Remove ${highlightedLabel as string}`, hidden: true }),
      );

      await flushMicrotasks();
      expect(input.getAttribute('aria-activedescendant')).toBe(null);
    });

    it('keeps highlight in sync after selecting then backspacing to a single match', async () => {
      const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      const { user } = await render(
        <Combobox.Root items={items} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Select index 4
      await user.click(screen.getByRole('option', { name: 'epsilon' }));
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);

      // Reopen and press Backspace to narrow to a single match
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Backspace once: from 'epsilon' -> 'epsilo', which should still only match 'epsilon'
      await user.keyboard('{Backspace}');
      const epsilon = await screen.findByRole('option', { name: 'epsilon' });
      // With autoHighlight, the first (and only) item should be highlighted
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', epsilon.id));
    });

    it('navigates on first ArrowDown after editing selection to a new matching query', async () => {
      const { user } = await render(
        <Combobox.Root items={['Apple', 'Grape', 'Grapefruit']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      // Open and select Apple
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      // Edit input to "Ape" (matches Grape and Grapefruit)
      await user.click(input);
      await user.clear(input);
      await user.type(input, 'Ape');
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const grape = screen.getByRole('option', { name: 'Grape' });
      const grapefruit = screen.getByRole('option', { name: 'Grapefruit' });

      // With autoHighlight, first match is highlighted immediately
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', grape.id));

      // One ArrowDown should move to the next match (no double keypress needed)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', grapefruit.id));
    });

    it('updates highlighted callback with newly filtered first item', async () => {
      const onItemHighlighted = vi.fn();
      const items = ['banana', 'apple', 'apricot'];

      const { user } = await render(
        <Combobox.Root
          items={items}
          autoHighlight
          defaultOpen
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [initialValue] = onItemHighlighted.mock.lastCall ?? [];
      expect(initialValue).toBe('banana');

      onItemHighlighted.mockClear();

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [nextValue, data] = onItemHighlighted.mock.lastCall ?? [];
      expect(nextValue).toBe('apple');
      expect(data.reason).toBe('none');
      expect(data.index).toBe(0);
    });

    it('fires a single clearing highlight on Enter selection', async () => {
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Combobox.Root
          items={['Apple', 'Apricot', 'Banana']}
          autoHighlight
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.type(input, 'app');

      // Reset history to focus on close events only.
      onItemHighlighted.mockClear();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      const clearingCalls = onItemHighlighted.mock.calls.filter((call) => call[0] === undefined);
      expect(clearingCalls.length).toBe(1);
      const postClearCalls = onItemHighlighted.mock.calls.slice(
        onItemHighlighted.mock.calls.indexOf(clearingCalls[0]!) + 1,
      );
      expect(postClearCalls.every((c) => c[0] === undefined)).toBe(true);
    });
  });

  describe('prop: onItemHighlighted', () => {
    it('fires on keyboard navigation', async () => {
      const items = ['a', 'b', 'c'];
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Combobox.Root items={items} onItemHighlighted={onItemHighlighted}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [value, eventDetails] = onItemHighlighted.mock.lastCall ?? [];
      expect(value).toBe('a');
      expect(eventDetails.reason).toBe('keyboard');
      expect(eventDetails.index).toBe(0);
      expect(eventDetails.event).toBeInstanceOf(KeyboardEvent);
      expect(eventDetails.event.key).toBe('ArrowDown');
    });

    it('passes native mouse and pointer events for pointer highlights', async () => {
      const items = ['a', 'b', 'c'];
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Combobox.Root items={items} onItemHighlighted={onItemHighlighted}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('input'));
      const option = await screen.findByRole('option', { name: 'b' });
      const hoverEvent = new MouseEvent('mousemove', { bubbles: true, movementX: 1 });
      await fireEvent(option, hoverEvent);

      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith('b', expect.anything());
      });
      const eventDetails = onItemHighlighted.mock.lastCall?.[1];
      expect(eventDetails.reason).toBe('pointer');
      expect(eventDetails.event).toBeInstanceOf(MouseEvent);
      expect(eventDetails.event).toBe(hoverEvent);
      expect(eventDetails.event).not.toBeInstanceOf(PointerEvent);

      const leaveEvent = new PointerEvent('pointerleave', { pointerType: 'mouse' });
      await fireEvent(option, leaveEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(
          undefined,
          expect.objectContaining({ reason: 'pointer', event: leaveEvent }),
        );
      });
      expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(leaveEvent);
    });

    const HighlightCombobox = defineComponent({
      props: {
        onItemHighlighted: Function as PropType<
          (value: string | undefined, details: Combobox.Root.HighlightEventDetails) => void
        >,
      },
      setup(props) {
        return () => (
          <Combobox.Root
            items={['apple', 'apricot', 'banana']}
            onItemHighlighted={props.onItemHighlighted}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Clear data-testid="clear" keepMounted />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      },
    });

    async function highlightFirstWithKeyboard(
      user: Awaited<ReturnType<typeof render>>['user'],
      onItemHighlighted: ReturnType<typeof vi.fn>,
    ) {
      await user.click(screen.getByTestId('input'));
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith('apple', expect.anything());
      });
    }

    it('reports a pointer highlight after keyboard navigation', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<HighlightCombobox onItemHighlighted={onItemHighlighted} />);
      await highlightFirstWithKeyboard(user, onItemHighlighted);

      await moveOver(screen.getByRole('option', { name: 'banana' }));
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith('banana', expect.anything());
      });
      expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe('pointer');
    });

    it('reports no keyboard reason when typing clears the highlight', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<HighlightCombobox onItemHighlighted={onItemHighlighted} />);
      await highlightFirstWithKeyboard(user, onItemHighlighted);

      await user.keyboard('a');
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.anything());
      });
      expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe('none');
    });

    it('reports no keyboard reason when the clear button clears the highlight', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<HighlightCombobox onItemHighlighted={onItemHighlighted} />);
      await highlightFirstWithKeyboard(user, onItemHighlighted);

      await fireEvent.click(screen.getByTestId('clear'));
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.anything());
      });
      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe('none');
      expect(details.event.type).toBe('click');
    });
  });

  describe('highlight restoration when clearing the query', () => {
    it('returns the highlight to the selected item when the input is cleared', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="cherry">
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const activeId = input.getAttribute('aria-activedescendant');
      expect(document.getElementById(activeId!)?.textContent).toBe('cherry');
    });

    it('returns the highlight to the selected item without the items prop', async () => {
      const { user } = await render(
        <Combobox.Root defaultValue="cherry">
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const activeId = input.getAttribute('aria-activedescendant');
      expect(document.getElementById(activeId!)?.textContent).toBe('cherry');
    });

    it('restores an array-valued single selection when the query is cleared', async () => {
      const items = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];

      const { user } = await render(
        <Combobox.Root
          items={items}
          defaultValue={items[1]}
          itemToStringLabel={(item: number[]) => item.join('-')}
        >
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: number[] }) => (
                      <Combobox.Item key={item.join('-')} value={item}>
                        {item.join('-')}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      // The array is a single-select value, not a list of selected values.
      const selected = screen.getByRole('option', { name: '3-4' });
      await waitFor(() => expect(selected).toHaveAttribute('data-highlighted'));

      await user.type(input, '1');
      await screen.findByRole('option', { name: '1-2' });

      await user.clear(input);
      const restored = await screen.findByRole('option', { name: '3-4' });
      await waitFor(() => expect(restored).toHaveAttribute('data-highlighted'));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', restored.id));
    });

    it('does not highlight anything when there is no selected item', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
  });

  describe('prop: open', () => {
    it('controls the open state', async () => {
      const { setProps, user } = await render(
        <Combobox.Root open={false}>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await setProps({ open: true });
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.click(document.body);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });
    });

    it('keeps filtering responsive after selection when inline and open is controlled', async () => {
      const items = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];

      const { user } = await render(
        <Combobox.Root items={items} open inline>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {{
              item: ({ item }: { item: string }) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                </Combobox.Item>
              ),
            }}
          </Combobox.List>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.type(input, 'ap');

      expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);

      await user.click(screen.getByRole('option', { name: 'Apple' }));

      await user.clear(input);
      await user.type(input, 'ba');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
      });
    });

    it('releases filtering when a controlled popup ignores a close request', async () => {
      const items = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
      const onOpenChange = vi.fn();

      const { user } = await render(
        <Combobox.Root items={items} open onOpenChange={onOpenChange}>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.type(input, 'ap');

      expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);

      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(screen.getByRole('dialog')).not.toBe(null);

      await user.clear(input);
      await user.type(input, 'ba');

      expect(input).toHaveValue('ba');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
      });
      expect(screen.queryByRole('option', { name: 'Apple' })).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'keeps filtered content stable when a controlled close is deferred',
      async ({ onTestFinished }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
        });

        const Test = defineComponent(() => {
          const open = shallowRef(true);
          const closeTimeout = useTimeout();

          return () => (
            <>
              <style>{closeAnimationStyle}</style>
              <Combobox.Root
                items={['Apple', 'Apricot', 'Banana']}
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  if (!nextOpen) {
                    closeTimeout.start(50, () => {
                      open.value = false;
                    });
                  }
                }}
              >
                <Combobox.Input data-testid="input" />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup data-testid="popup" class="animation-test-popup">
                      <Combobox.List>
                        {{
                          item: ({ item }: { item: string }) => (
                            <Combobox.Item key={item} value={item}>
                              {item}
                            </Combobox.Item>
                          ),
                        }}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            </>
          );
        });

        const { user } = await render(<Test />);
        await user.type(screen.getByTestId('input'), 'ap');

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', {
          action: () => user.click(screen.getByRole('option', { name: 'Apple' })),
        });
        expect(popup).toHaveAttribute('data-ending-style');

        expect(screen.getByTestId('input')).toHaveValue('Apple');
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);
      },
    );
  });

  describe('prop: defaultOpen', () => {
    it('mounts the popup on the first render', async () => {
      const mountedOnRender: boolean[] = [];

      const MountedProbe = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        const mounted = computed(() => rootStore.select('mounted'));
        return () => {
          mountedOnRender.push(mounted.value);
          return null;
        };
      });

      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <MountedProbe />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(mountedOnRender[0]).toBe(true);
    });
  });

  describe('prop: onOpenChange', () => {
    it('fires when opening and closing', async () => {
      const onOpenChange = vi.fn();

      const { user } = await render(
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(onOpenChange.mock.calls.length).toBeGreaterThan(0);
      });
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

      // Close by clicking outside
      await user.click(document.body);
      await waitFor(() => {
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      });
    });

    it('ignores a request to open an open popup before anything is notified', async () => {
      const onOpenChange = vi.fn();
      const handleInteractionOpenChange = vi.fn();

      const InteractionOpenChangeListener = defineComponent(() => {
        const rootStore = useComboboxRootContext();
        onMounted(() => {
          rootStore.context.events.on('openchange', handleInteractionOpenChange);
        });
        onScopeDispose(() => {
          rootStore.context.events.off('openchange', handleInteractionOpenChange);
        });
        return () => null;
      });

      const { user } = await render(
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <InteractionOpenChangeListener />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      input.focus();
      await flushMicrotasks();
      await user.keyboard('a');
      expect(await screen.findByRole('listbox')).not.toBe(null);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(handleInteractionOpenChange).toHaveBeenCalledTimes(1);

      // Each keystroke and press on the input requests an open.
      await user.keyboard('p');
      await user.click(input);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(handleInteractionOpenChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('prop: limit', () => {
    it('keeps the selected index unset when the selected item is outside the rendered limit', async () => {
      const items = ['apple', 'banana', 'cherry', 'date'];
      const { user } = await render(
        <Combobox.Root items={items} limit={2} defaultValue="date">
          <Combobox.Input />
          <SelectedIndexProbe />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');

      await user.click(screen.getByRole('combobox'));

      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
      expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute('data-highlighted');
      expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
        'data-highlighted',
      );
    });

    it('limits the number of items displayed when no groups are used', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      await render(
        <Combobox.Root items={items} limit={3} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should only show the first 3 items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'elderberry' })).toBe(null);
    });

    it('limits the number of items displayed when groups are used', async () => {
      const items = [
        {
          value: 'citrus',
          items: ['orange', 'lemon', 'lime'],
        },
        {
          value: 'berries',
          items: ['strawberry', 'blueberry', 'raspberry'],
        },
      ];

      await render(
        <Combobox.Root items={items} limit={4} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item: group }: { item: (typeof items)[number] }) => (
                      <Combobox.Group key={group.value} items={group.items}>
                        <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                        <Combobox.Collection>
                          {({ item }: { item: string }) => (
                            <Combobox.Item key={item} value={item}>
                              {item}
                            </Combobox.Item>
                          )}
                        </Combobox.Collection>
                      </Combobox.Group>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show first 4 items across groups
      expect(screen.getByRole('option', { name: 'orange' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'lemon' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'lime' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'strawberry' })).not.toBe(null);
      // These should be limited out
      expect(screen.queryByRole('option', { name: 'blueberry' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'raspberry' })).toBe(null);

      // Group labels should still be visible
      expect(screen.getByText('citrus')).not.toBe(null);
      expect(screen.getByText('berries')).not.toBe(null);
    });

    it('respects limit when filtering items', async () => {
      const items = ['apple', 'apricot', 'avocado', 'banana', 'blueberry'];
      const { user } = await render(
        <Combobox.Root items={items} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      // Type 'a' to filter items starting with 'a'
      await user.type(input, 'a');
      await flushMicrotasks();

      // Should only show first 2 filtered items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apricot' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'avocado' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'blueberry' })).toBe(null);
    });

    it('stops filtering grouped items once the limit is reached', async () => {
      const items = [
        {
          value: 'groupA',
          items: ['banana', 'apple', 'apricot', 'avocado'],
        },
        {
          value: 'groupB',
          items: ['artichoke', 'banana', 'blueberry'],
        },
      ];

      const filter = vi.fn((itemValue: string, query: string) => itemValue.startsWith(query));

      const { user } = await render(
        <Combobox.Root items={items} filter={filter} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item: group }: { item: (typeof items)[number] }) => (
                      <Combobox.Group key={group.value} items={group.items}>
                        <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                        <Combobox.Collection>
                          {({ item }: { item: string }) => (
                            <Combobox.Item key={item} value={item}>
                              {item}
                            </Combobox.Item>
                          )}
                        </Combobox.Collection>
                      </Combobox.Group>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      filter.mockClear();

      await user.type(screen.getByTestId('input'), 'a');
      await flushMicrotasks();

      const filteredItemValues = filter.mock.calls.map(([itemValue]) => itemValue);

      expect(filteredItemValues).not.toContain('avocado');
      expect(filteredItemValues).not.toContain('artichoke');
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apricot' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'avocado' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'artichoke' })).toBe(null);
    });

    it('shows all items when limit is -1 (default)', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      await render(
        <Combobox.Root items={items} limit={-1} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show all items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'date' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'elderberry' })).not.toBe(null);
    });

    it('handles limit of 0 gracefully', async () => {
      const items = ['apple', 'banana', 'cherry'];
      await render(
        <Combobox.Root items={items} limit={0} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show no items
      expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
    });

    it('preserves order of items when applying limit across groups', async () => {
      const items = [
        {
          value: 'groupA',
          items: ['A1', 'A2'],
        },
        {
          value: 'groupB',
          items: ['B1', 'B2', 'B3'],
        },
      ];

      await render(
        <Combobox.Root items={items} limit={3} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item: group }: { item: (typeof items)[number] }) => (
                      <Combobox.Group key={group.value} items={group.items}>
                        <Combobox.GroupLabel>Group {group.value.slice(-1)}</Combobox.GroupLabel>
                        <Combobox.Collection>
                          {({ item }: { item: string }) => (
                            <Combobox.Item key={item} value={item}>
                              {item}
                            </Combobox.Item>
                          )}
                        </Combobox.Collection>
                      </Combobox.Group>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show first 3 items in order: A1, A2, B1
      expect(screen.getByRole('option', { name: 'A1' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'A2' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'B1' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'B2' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'B3' })).toBe(null);
    });

    it('does not limit items when not using items prop', async () => {
      await render(
        <Combobox.Root limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                  <Combobox.Item value="date">date</Combobox.Item>
                  <Combobox.Item value="elderberry">elderberry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show all items because limit only works with items prop
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'date' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'elderberry' })).not.toBe(null);
    });

    it('updates displayed items when limit changes', async () => {
      const items = ['apple', 'banana', 'cherry', 'date'];
      const { setProps } = await render(
        <Combobox.Root items={items} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Initially shows 2 items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);

      // Update limit to 3
      await setProps({ limit: 3 });
      await flushMicrotasks();

      // Now shows 3 items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);
    });
  });

  describe('dialog pattern', () => {
    const fruits = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
    const asyncFruits = ['apple', 'banana', 'cherry'];

    // A keepMounted dialog stays in the document after its close, with the attribute `hidden`.
    async function waitForDialogToHide() {
      await waitFor(() => {
        expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('hidden');
      });
    }

    it.each([
      [false, ''],
      [false, 'Ba'],
      [true, ''],
      [true, 'Ba'],
    ] as const)(
      'clears the highlight when a keepMounted dialog closes (multiple=%s, query="%s")',
      async (multiple, query) => {
        const onItemHighlighted = vi.fn();
        const onValueChange = vi.fn();

        const Test = defineComponent(() => {
          const open = shallowRef(false);
          return () => (
            <Combobox.Root
              inline
              multiple={multiple}
              items={['Apple', 'Banana']}
              open={open.value}
              onOpenChange={(next: boolean) => {
                open.value = next;
              }}
              onItemHighlighted={onItemHighlighted}
              onValueChange={(value: unknown) => {
                onValueChange(value);
                open.value = false;
              }}
            >
              <Dialog.Root
                open={open.value}
                onOpenChange={(next: boolean) => {
                  open.value = next;
                }}
              >
                <Dialog.Trigger>Choose fruit</Dialog.Trigger>
                <Dialog.Portal keepMounted>
                  <Dialog.Popup
                    aria-label="Fruit chooser"
                    style={{ opacity: open.value ? 1 : 0, transition: 'opacity 50ms' }}
                  >
                    <Combobox.Input />
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                    <Dialog.Close>Done</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Combobox.Root>
          );
        });

        const { user } = await render(<Test />);
        const trigger = screen.getByRole('button', { name: 'Choose fruit' });
        await user.click(trigger);
        const input = screen.getByRole('combobox');
        await waitFor(() => expect(input).toHaveFocus());
        if (query) {
          await user.type(input, query);
        }
        await user.keyboard(query ? '{ArrowDown}' : '{ArrowDown}{ArrowDown}');
        expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-highlighted');
        onItemHighlighted.mockClear();

        // Vue skips the listener of the item that the query mounted, in the millisecond of its mount.
        await waitForLaterMillisecond();
        await user.keyboard('{Enter}');
        await waitForDialogToHide();
        expect(onValueChange).toHaveBeenLastCalledWith(multiple ? ['Banana'] : 'Banana');
        expect(onItemHighlighted.mock.calls.map(([value]) => value)).toEqual([undefined]);

        async function reopenAndNavigate(closeWithEscape = false) {
          await user.click(trigger);
          await waitFor(() => expect(input).toHaveFocus());
          expect(input).not.toHaveAttribute('aria-activedescendant');
          onValueChange.mockClear();
          await user.keyboard('{Enter}');
          expect(onValueChange).not.toHaveBeenCalled();
          await user.keyboard('{ArrowDown}');
          if (closeWithEscape) {
            await user.keyboard('{Escape}');
          } else {
            await user.click(screen.getByRole('button', { name: 'Done' }));
          }
          await waitForDialogToHide();
        }

        await reopenAndNavigate(true);
        await reopenAndNavigate();
        await reopenAndNavigate();
      },
    );

    it('clears the highlight when an inline list in an unbound dialog unmounts', async () => {
      const onOpenChangeComplete = vi.fn();
      await render(
        <Combobox.Root inline items={['Apple', 'Banana', 'Cherry']}>
          <Dialog.Root onOpenChangeComplete={onOpenChangeComplete}>
            <Dialog.Trigger>Choose fruit</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <Combobox.Input />
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Choose fruit' });
      await fireEvent.click(trigger);
      let input = await screen.findByRole('combobox');
      await waitFor(() => expect(input).toHaveFocus());
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-highlighted');

      onOpenChangeComplete.mockClear();
      await fireEvent.keyDown(input, { key: 'Escape' });
      await waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).toBe(null);

      await fireEvent.click(trigger);
      input = await screen.findByRole('combobox');
      await waitFor(() => expect(input).toHaveFocus());
      expect(input).not.toHaveAttribute('aria-activedescendant');
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('data-highlighted');
    });

    const AsyncDialogCombobox = defineComponent(() => {
      const loading = shallowRef(true);
      const value = shallowRef<string | null>(null);

      const timeout = setTimeout(() => {
        loading.value = false;
      }, 0);
      onScopeDispose(() => clearTimeout(timeout));

      return () => (
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <form>
                <label for="name">Name</label>
                <input id="name" disabled={loading.value} />

                <label for="fruit">Fruit</label>
                <Combobox.Root
                  items={asyncFruits}
                  value={value.value}
                  onValueChange={(next: string | null) => {
                    value.value = next;
                  }}
                  disabled={loading.value}
                >
                  <Combobox.Input id="fruit" placeholder="Select fruit..." />
                  <Combobox.Trigger aria-label="Open" />
                  <Combobox.Portal>
                    <Combobox.Positioner>
                      <Combobox.Popup>
                        <Combobox.List>
                          {{
                            item: ({ item }: { item: string }) => (
                              <Combobox.Item key={item} value={item}>
                                {item}
                              </Combobox.Item>
                            ),
                          }}
                        </Combobox.List>
                      </Combobox.Popup>
                    </Combobox.Positioner>
                  </Combobox.Portal>
                </Combobox.Root>

                <button type="button">Cancel</button>
                <button type="submit" disabled={loading.value}>
                  Save
                </button>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    });

    const DialogMultipleCombobox = defineComponent({
      props: { defaultOpen: { type: Boolean, default: true } },
      setup(props) {
        const open = shallowRef(props.defaultOpen);
        return () => (
          <Combobox.Root multiple items={fruits} inline>
            <Dialog.Root
              open={open.value}
              onOpenChange={(next: boolean) => {
                open.value = next;
              }}
            >
              <Dialog.Trigger>Trigger</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup aria-label="Fruit chooser">
                  <Combobox.Chips>
                    <Combobox.Input data-testid="dialog-input" />
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Chips>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Combobox.Root>
        );
      },
    });

    const DialogSingleCombobox = defineComponent({
      props: { defaultOpen: { type: Boolean, default: true } },
      setup(props) {
        const open = shallowRef(props.defaultOpen);
        const inputId = useId();

        return () => (
          <Combobox.Root
            items={fruits}
            open={open.value}
            onOpenChange={(next: boolean) => {
              open.value = next;
            }}
            inline
          >
            <Dialog.Root
              open={open.value}
              onOpenChange={(next: boolean) => {
                open.value = next;
              }}
            >
              <Dialog.Trigger data-testid="dialog-trigger">
                <Combobox.Value
                  v-slots={{
                    default: ({ value }: { value: string | null }) => value ?? 'Select a fruit',
                  }}
                />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup aria-label="Fruit chooser">
                  <div>
                    <label for={inputId}>Fruit</label>
                    <Combobox.Input
                      id={inputId}
                      data-testid="dialog-input"
                      placeholder="e.g. Apple"
                    />
                  </div>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                  <Dialog.Close>Done</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Combobox.Root>
        );
      },
    });

    it('does not let pending dialog initial focus steal focus from an async-enabled combobox', async () => {
      // Keep the dialog's initial-focus rAF pending until after the combobox click.
      // The GitHub repro depends on this timing; otherwise the rAF can fire before the click.
      const frameCallbacks = new Map<number, FrameRequestCallback>();
      let frameId = 0;
      const requestAnimationFrameSpy = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          frameId += 1;
          frameCallbacks.set(frameId, callback);
          return frameId;
        });
      const cancelAnimationFrameSpy = vi
        .spyOn(window, 'cancelAnimationFrame')
        .mockImplementation((id) => {
          frameCallbacks.delete(id);
        });

      try {
        const { user } = await render(<AsyncDialogCombobox />);

        await waitFor(() => expect(screen.getByLabelText('Fruit')).toBeEnabled());
        await user.click(screen.getByLabelText('Fruit'));

        expect(await screen.findByRole('listbox')).toBeVisible();

        const callbacks = Array.from(frameCallbacks.values());
        frameCallbacks.clear();
        callbacks.forEach((callback) => callback(performance.now()));
        await flushMicrotasks();

        expect(screen.getByLabelText('Fruit')).toHaveFocus();
        expect(screen.getByRole('listbox')).toBeVisible();
      } finally {
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
      }
    });

    describe('multiple', () => {
      it('clears input after filtering, removes filter and highlight', async () => {
        const { user } = await render(<DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).toHaveValue('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
        });
        expect(input).toHaveAttribute('aria-activedescendant');
      });

      it('still filters after selecting an item', async () => {
        const { user } = await render(<DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).toHaveValue('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
        });
        expect(input).toHaveAttribute('aria-activedescendant');

        await user.type(input, 'ap');

        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      });

      it('retains highlight on selected item when not filtering', async () => {
        const { user } = await render(<DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        input.focus();
        await flushMicrotasks();

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });

        await user.keyboard('{Enter}');

        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
      });
    });

    describe('single', () => {
      it('closes the dialog after selecting an item and updates the trigger value', async () => {
        const { user } = await render(<DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await flushMicrotasks();
        expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).toBe(null);

        await waitFor(() => {
          expect(trigger).toHaveTextContent('Apple');
        });
      });

      it('clears the filter input when re-opening after a selection', async () => {
        const { user } = await render(<DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await flushMicrotasks();
        expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).toBe(null);

        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const reopenedInput = await screen.findByTestId('dialog-input');

        expect(reopenedInput).toHaveValue('');
        await screen.findByRole('option', { name: 'Banana' });
      });

      it('restores highlight when the input regains focus', async () => {
        const { user } = await render(<DialogSingleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        input.focus();
        await flushMicrotasks();

        await user.keyboard('{ArrowDown}');

        const apple = screen.getByRole('option', { name: 'Apple' });

        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
        expect(apple).toHaveAttribute('data-highlighted');

        const done = screen.getByRole('button', { name: 'Done' });
        await fireEvent.focusOut(input, { relatedTarget: done });
        await fireEvent.focusIn(done);
        await flushMicrotasks();

        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(apple).not.toHaveAttribute('data-highlighted');

        await fireEvent.focusOut(done, { relatedTarget: input });
        await fireEvent.focusIn(input);

        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
        expect(apple).toHaveAttribute('data-highlighted');
      });
    });
  });

  hiddenInputTypeTests({
    render,
    createComponent: (props) => (
      <Combobox.Root {...props}>
        <Combobox.Input data-testid="input" />
      </Combobox.Root>
    ),
  });

  hiddenInputSizeTests({
    render,
    createComponent: (props) => (
      <Combobox.Root {...props}>
        <Combobox.Input />
      </Combobox.Root>
    ),
  });

  describe('coverage edge cases', () => {
    it('safely handles hidden-control focus without a visible control', async () => {
      await render(<Combobox.Root />);
      const hiddenInput = getHiddenInput();

      await fireEvent.focusIn(hiddenInput);

      expect(document.body).toHaveFocus();
    });
  });
});
