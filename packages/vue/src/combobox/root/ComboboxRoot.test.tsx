import { popupBindings } from '../../utils/popups/popupBindings';
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
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox, ComboboxSeparatorDataAttributes } from '@vase-ui/vue/combobox';
import { Dialog } from '@vase-ui/vue/dialog';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Input } from '@vase-ui/vue/input';
import { Popover } from '@vase-ui/vue/popover';
import {
  createFormDataSpy,
  createHeldBranch,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  heldMountFormResetTests,
  hiddenInputSizeTests,
  hiddenInputTypeTests,
  hydrate,
  hydrateAfter,
  isJSDOM,
  nextEvent,
  popupAnatomyTests,
  popupConformanceTests,
  popupListConformanceTests,
  pressWithTouch,
  recordInputEvents,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
  within,
} from '#test-utils';
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import CompositeItem from '../../../test/fixtures/CompositeItemPart.vue';
import CompositeRoot from '../../../test/fixtures/CompositeRootPart.vue';
import { isScrollLocked } from '../../../test/fixtures/scrollDocument';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { HTMLProps } from '../../internals/types';
import { REASONS } from '../../internals/reasons';
import type { ComboboxStore } from '../store';
import { useComboboxInputValueContext, useComboboxRootContext } from './ComboboxRootContext';
import type { ComboboxInputElementValue } from './ComboboxRootContext';
import ComboboxRootBeforeHydration from './ComboboxRootBeforeHydration.test.vue';
import ComboboxRootHydration from './ComboboxRootHydration.test.vue';
import ComboboxRootRenders from './ComboboxRootRenders.test.vue';

// Most cases of Vase UI's own use the fixture parts in place of the positioner, the list and the
// items, and they test the root. Most of them also use the fixture input. It handles only the
// `input` event, and its `insidePopup` prop stands for a positioner around it. The Base UI cases
// of this file render the parts of the family. A ported case replaces the case of Vase UI's own
// that tests the same thing: the order of the events, a canceled change, the controlled values,
// the hidden inputs, the autofill, the field and the server render.

const HYDRATION_FILE = 'src/combobox/root/ComboboxRootHydration.test.vue';
const BEFORE_HYDRATION_FILE = 'src/combobox/root/ComboboxRootBeforeHydration.test.vue';
const cities = ['Malmö', 'Malta', 'Oslo'];
const addresses = ['Main Street 1\nFlat 2', 'Box 1'];

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

// WebKit sends a `mousemove` with no movement under a pointer that does not move, and the list
// ignores such an event. The `mousemove` of `user.hover` has no movement.
async function moveOver(element: HTMLElement) {
  await fireEvent.mouseMove(element, { movementX: 1 });
}

const AsyncItemsCombobox = defineComponent(() => {
  const items = shallowRef(['Apple', 'Banana', 'Cherry']);
  const selectedValue = shallowRef<string | null>(null);

  return () => (
    <Combobox.Root
      items={items.value}
      onValueChange={(value: string | null) => {
        selectedValue.value = value;
      }}
      onOpenChangeComplete={(open: boolean) => {
        if (!open && selectedValue.value) {
          items.value = [selectedValue.value];
        }
      }}
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
    </Combobox.Root>
  );
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

const ActiveIndexProbe = defineComponent(() => {
  const rootStore = useComboboxRootContext();
  const activeIndex = computed(() => rootStore.select('activeIndex'));

  return () => (
    <div data-testid="active-index">
      {activeIndex.value === null ? 'null' : `${activeIndex.value}`}
    </div>
  );
});

const ClearActiveIndexButton = defineComponent(() => {
  const rootStore = useComboboxRootContext();

  return () => (
    <button type="button" onClick={() => rootStore.context.setIndices({ activeIndex: null })}>
      Clear highlight
    </button>
  );
});

function MultiplePopupCombobox(props: {
  items?: readonly string[];
  defaultValue?: string[];
  onItemHighlighted?: (
    item: string | undefined,
    eventDetails: Combobox.Root.HighlightEventDetails,
  ) => void;
}) {
  const {
    items = ['apple', 'banana', 'cherry'],
    defaultValue = ['apple', 'banana'],
    onItemHighlighted,
  } = props;

  return (
    <Combobox.Root
      items={items}
      multiple
      defaultValue={defaultValue}
      onItemHighlighted={onItemHighlighted}
    >
      <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
      <ActiveIndexProbe />
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
    </Combobox.Root>
  );
}

describe('<Combobox.Root />', () => {
  const { render } = createRenderer();

  async function renderAddresses(defaultValue: string) {
    const handleValueChange = vi.fn();
    const { container } = await render(
      <form data-testid="form">
        <Combobox.Root
          name="address"
          items={addresses}
          defaultValue={defaultValue}
          onValueChange={handleValueChange}
        >
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      </form>,
    );
    return { handleValueChange, events: recordInputEvents(container) };
  }

  popupAnatomyTests({
    held: {
      createRoot: ({ open, onOpenChangeComplete, keepMounted, content }) => (
        <Combobox.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
          <Combobox.Input />
          <Combobox.Portal keepMounted={keepMounted}>{content}</Combobox.Portal>
        </Combobox.Root>
      ),
      createPopup: () => (
        <Combobox.Positioner>
          <Combobox.Popup data-testid="popup">Popup</Combobox.Popup>
        </Combobox.Positioner>
      ),
    },
    createComponent: ({ open, onOpenChangeComplete, content }) => (
      <Combobox.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner data-testid="shown" class="shown">
            Content
            {content}
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    createPopup: () => <Combobox.Popup data-testid="popup">Popup</Combobox.Popup>,
    createBackdropComponent: ({ open, onOpenChangeComplete }) => (
      <Combobox.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Backdrop data-testid="shown" class="shown" />
        </Combobox.Portal>
      </Combobox.Root>
    ),
    createPendingPositionerComponent: ({ Pending, onOpenChange }) => (
      <Combobox.Root defaultOpen modal onOpenChange={onOpenChange}>
        <Combobox.Input />
        <Combobox.Portal>
          <Pending>
            <Combobox.Positioner data-testid="shown">
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">A</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Pending>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    render,
  });

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

  popupConformanceTests({
    createComponent: (props) => (
      <Combobox.Root {...props.root}>
        <Combobox.Input data-testid="trigger" />
        <Combobox.Portal {...props.portal}>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List {...props.popup}>
                <Combobox.Item value="item">Item</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'listbox',
    combobox: true,
    openReason: REASONS.inputPress,
    // The `popup` props go to the List (it carries the listbox role), which has no exit state.
    exitAnimation: false,
  });

  popupListConformanceTests({
    createComponent: ({ root, items, disabledItems, scrollerStyle, itemStyle, onItemClick }) => (
      <Combobox.Root items={items} {...root}>
        <Combobox.Input data-testid="trigger" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List data-testid="scroller" style={scrollerStyle}>
                {{
                  item: ({ item }: { item: string }) => (
                    <Combobox.Item
                      key={item}
                      value={item}
                      disabled={disabledItems.includes(item)}
                      style={itemStyle}
                      onClick={onItemClick}
                    >
                      <span>{item}</span>
                    </Combobox.Item>
                  ),
                }}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    render,
    itemRole: 'option',
    focusModel: 'virtual',
    homeEnd: false,
    selectable: true,
    enterSpaceOpen: false,
    typeahead: false,
    modal: false,
    triggerClickCloses: false,
    listEnd: 'escape',
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const onInputFocus = vi.fn();
    input.addEventListener('focus', onInputFocus);

    await user.click(trigger);
    // The `mousedown` of the press gives the trigger the focus one frame before the popup closes.
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
    expect(trigger).toHaveFocus();
    expect(onInputFocus).not.toHaveBeenCalled();
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
      const input = await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        return screen.findByTestId('input');
      });
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ban');
      await user.keyboard('{ArrowDown}{Enter}');

      expect(screen.queryByRole('dialog')).toBe(null);
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
      const input = await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        return screen.findByTestId('input');
      });
      await user.type(input, 'ban');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBe(null);
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

      const input = await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        return screen.findByTestId('input');
      });
      await user.type(input, 'ap');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(screen.getByTestId('trigger')).toHaveTextContent('Apple');

      await user.clear(input);
      await user.type(input, 'ba');

      expect(await screen.findByRole('option', { name: 'Banana' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'Apple' })).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'clears a single-select query and restores the selection when reopening during the close animation',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const { user } = await render(
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root items={['Apple', 'Banana']} defaultValue="Banana">
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <SelectedIndexProbe />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
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
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByTestId('input');
        });
        await user.clear(input);
        await user.type(input, 'banana');

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');

        await user.click(trigger);

        await waitFor(() => expect(popup).toHaveAttribute('data-open'));
        // The popup removes the ending style in a frame after the reopen.
        await waitSingleFrame();
        await waitSingleFrame();
        expect(popup).not.toHaveAttribute('data-ending-style');
        expect(screen.getByTestId('selected-index')).toHaveTextContent('1');
        expect(input).toHaveValue('');
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        const bananaItem = screen.getByRole('option', { name: 'Banana' });
        await waitFor(() => expect(bananaItem).toHaveAttribute('data-highlighted'));
        await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', bananaItem.id));
      },
    );

    it.skipIf(isJSDOM)(
      'preserves a typed query when input reopens single-select during the close animation',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const { user } = await render(
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root items={['Apple', 'Banana']}>
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
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

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });
        await user.type(input, 'ap');

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');

        input.focus();
        await user.type(input, 'b', { skipClick: true });

        await waitFor(() => expect(popup).toHaveAttribute('data-open'));
        // The popup removes the ending style in a frame after the reopen.
        await waitSingleFrame();
        await waitSingleFrame();
        expect(popup).not.toHaveAttribute('data-ending-style');
        expect(input).toHaveValue('apb');
        expect(screen.getByRole('status')).toHaveTextContent('No matches');
        expect(screen.queryByRole('option')).toBe(null);
      },
    );
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

    expect(screen.queryByRole('listbox')).toBe(null);
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

    const nestedContent = await waitForLaterMillisecond(async () => {
      await user.click(screen.getByRole('button', { name: 'Open nested popover' }));
      return screen.findByRole('button', { name: 'Nested focusable content' });
    });
    await user.click(nestedContent);

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
      expect(screen.getByRole('listbox')).not.toBe(null);
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

    expect(screen.queryByRole('listbox')).toBe(null);
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

    expect(screen.queryByRole('listbox')).toBe(null);
  });

  describe('events', () => {
    it('emits valueChange, update:modelValue, inputValueChange, update:inputValue, openChange and update:open in this order for a pick', async () => {
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
            'onUpdate:modelValue': (value: unknown) =>
              events.push(`update:modelValue:${String(value)}`),
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
        'update:modelValue:Malta',
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
              'onUpdate:modelValue': () => updates.push('value'),
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

    it.each([
      { name: 'a string value', props: { items: cities, defaultValue: 'Malta' } },
      {
        name: 'an object equal by isItemEqualToValue',
        props: {
          items: [
            { value: 'malmo', label: 'Malmö' },
            { value: 'malta', label: 'Malta' },
          ],
          defaultValue: { value: 'malta', label: 'Malta' },
          isItemEqualToValue: (item: { value: string }, value: { value: string }) =>
            item.value === value.value,
        },
      },
    ])(
      'VUE-91: emits no valueChange and no inputValueChange for a pick of the selected item, $name',
      async ({ props }) => {
        const rootProps: Record<string, unknown> = props;
        const events: string[] = [];
        await render(
          <Combobox.Root
            {...rootProps}
            defaultOpen
            onValueChange={(_, details) => events.push(`valueChange:${details.reason}`)}
            onInputValueChange={(value, details) =>
              events.push(`inputValueChange:${String(value)}:${details.reason}`)
            }
            onOpenChange={(open, details) => events.push(`openChange:${open}:${details.reason}`)}
            {...{
              'onUpdate:modelValue': () => events.push('update:modelValue'),
              'onUpdate:inputValue': () => events.push('update:inputValue'),
            }}
          >
            <ComboboxInputPart />
            <ComboboxListPart />
          </Combobox.Root>,
        );
        expect(getInput().value).toBe('Malta');

        await pick('Malta');

        expect(events).toEqual(['openChange:false:item-press']);
        expect(getInput().value).toBe('Malta');
      },
    );

    it('VUE-91: fills the input for a pick of the selected item after a typed query', async () => {
      const events: string[] = [];
      await render(
        <Combobox.Root
          items={cities}
          defaultValue="Malta"
          onValueChange={(_, details) => events.push(`valueChange:${details.reason}`)}
          onInputValueChange={(value, details) =>
            events.push(`inputValueChange:${String(value)}:${details.reason}`)
          }
          onOpenChange={(open, details) => events.push(`openChange:${open}:${details.reason}`)}
        >
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );

      await type('ma');
      events.length = 0;
      await pick('Malta');

      expect(events).toEqual(['inputValueChange:Malta:item-press', 'openChange:false:item-press']);
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
          modelValue={value.value}
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

    it('emits an item of a list with no items prop only after the item registered', async () => {
      const visibleItems = shallowRef(['apple', 'banana', 'cherry']);
      const handleItemHighlighted = vi.fn();
      await render(() => (
        <Combobox.Root
          defaultOpen
          autoHighlight
          onInputValueChange={(query: string) => {
            visibleItems.value = query ? ['cherry'] : ['apple', 'banana', 'cherry'];
          }}
          onItemHighlighted={handleItemHighlighted}
        >
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
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
      ));

      await type('c');

      expect(
        handleItemHighlighted.mock.calls.map(([value, details]) => `${value}:${details.index}`),
      ).toEqual(['cherry:0']);
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
          hasPopupListeners: Object.keys(popupBindings(rootStore)).length > 0,
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
            modelValue="Oslo"
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

    it('VUE-91: puts back a default object that isItemEqualToValue matches with the value', async () => {
      const defaultValue = { value: 'oslo', label: 'Oslo' };
      const validate = vi.fn((value: unknown) =>
        (value as { value: string } | null)?.value === 'malta' ? 'Not Malta' : null,
      );
      const handleValueChange = vi.fn();
      await render(
        <form data-testid="form">
          <Field.Root data-testid="field" validate={validate} validationMode="onChange">
            <Combobox.Root
              items={[
                { value: 'malta', label: 'Malta' },
                { value: 'oslo', label: 'Oslo' },
              ]}
              defaultValue={defaultValue}
              isItemEqualToValue={(item: { value: string }, value: { value: string }) =>
                item.value === value.value
              }
              onValueChange={handleValueChange}
            >
              <ComboboxInputPart />
              <ComboboxListPart />
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </form>,
      );
      await type('ma');
      await pick('Malta');
      await type('os');
      await pick('Oslo');
      expect(screen.getByTestId('field')).toHaveAttribute('data-dirty', '');

      await reset();

      expect(handleValueChange).toHaveBeenCalledTimes(3);
      expect(handleValueChange.mock.lastCall?.[0]).toBe(defaultValue);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-dirty');

      // The next change gets its validation.
      await type('ma');
      await pick('Malta');
      vi.advanceTimersByTime(0);
      await flushMicrotasks();

      expect(screen.getByTestId('error')).toHaveTextContent('Not Malta');
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

  heldMountFormResetTests({
    render,
    renderControl: () => (
      <Combobox.Root name="city" items={cities} defaultValue="Oslo">
        <ComboboxInputPart />
        <ComboboxListPart />
      </Combobox.Root>
    ),
    change: async () => {
      await waitForLaterMillisecond(() => type('ma'));
      await pick('Malmö');
    },
    readState: () => getInput().value,
    defaultState: 'Oslo',
    changedState: 'Malmö',
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

    it('handles no change event for the value that the hidden input has', async () => {
      const { handleValueChange } = await renderAddresses('Main Street 1\nFlat 2');
      expect(getHiddenInput().value).toBe('Main Street 1Flat 2');

      getHiddenInput().dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(getOptions()).toEqual([]);
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
              modelValue={value.value}
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

    it.each([{ name: 'held mount' }, { name: 'deactivated' }])(
      'a held required combobox does not block the submit of its form: $name',
      async ({ name }) => {
        const handleSubmit = vi.fn();
        const { HeldBranch, mountWhileHeld } = createHeldBranch(
          () => (
            <Combobox.Root key="held" items={cities} required>
              <Combobox.Input />
            </Combobox.Root>
          ),
          { mounted: name === 'deactivated' },
        );
        const { user } = await render(() => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="city" data-testid="field">
              <Field.Control defaultValue="shown" />
              <HeldBranch />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        ));

        await mountWhileHeld();
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        expect(handleSubmit).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
      },
    );

    it('the label does not name a combobox that mounts while KeepAlive holds it', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <Combobox.Root key="held" items={cities} id="held-combobox">
          <Combobox.Input />
        </Combobox.Root>
      ));
      await render(() => (
        <Field.Root>
          <Field.Label data-testid="label">City</Field.Label>
          <HeldBranch />
        </Field.Root>
      ));
      const label = screen.getByTestId('label');
      const providerId = label.getAttribute('for');

      await mountWhileHeld();

      expect(label.getAttribute('for')).toBe(providerId);

      await show();

      expect(label).toHaveAttribute('for', 'held-combobox');
    });
  });

  describe('VUE-84: the listener of the opening press', () => {
    function spyOnPressListeners() {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      onTestFinished(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
      });
      const count = (spy: typeof addSpy | typeof removeSpy) =>
        spy.mock.calls.filter(([eventType]) => eventType === 'mousedown').length;
      return () => [count(addSpy), count(removeSpy)];
    }

    async function openWithPress() {
      await fireEvent.mouseDown(getInput(), { button: 0 });
      await waitFor(() => {
        expect(getInput()).toHaveAttribute('aria-expanded', 'true');
      });
    }

    it('removes the listener when the root unmounts', async () => {
      const countListeners = spyOnPressListeners();
      const { unmount } = await render(
        <Combobox.Root items={cities}>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      await openWithPress();
      expect(countListeners()).toEqual([1, 0]);

      unmount();

      expect(countListeners()).toEqual([1, 1]);
    });

    it('removes the listener when KeepAlive deactivates the root', async () => {
      const countListeners = spyOnPressListeners();
      const shown = shallowRef(true);
      await render(() => (
        <KeepAlive>
          {shown.value ? (
            <Combobox.Root key="root" items={cities}>
              <ComboboxInputPart />
              <ComboboxListPart />
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
      await openWithPress();
      expect(countListeners()).toEqual([1, 0]);

      shown.value = false;
      await flushMicrotasks();

      expect(countListeners()).toEqual([1, 1]);
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

  describe('VUE-81: the state that the input got before the hydration', () => {
    it('takes the value that a program wrote into the hidden input', async () => {
      const serverHtml = await renderOnServer(BEFORE_HYDRATION_FILE);
      let events: string[] = [];

      const { container } = await hydrateAfter(ComboboxRootBeforeHydration, {
        serverHtml,
        before(serverContainer) {
          events = recordInputEvents(serverContainer);
          serverContainer.querySelector<HTMLInputElement>('input[name="city"]')!.value = 'Oslo';
        },
      });
      await flushMicrotasks();
      await flushMicrotasks();

      const fixture = within(container);
      expect(fixture.getByTestId('model').textContent).toBe('Oslo');
      expect(fixture.getByTestId('changes').textContent).toBe('Oslo (none)');
      expect(getInput().value).toBe('Oslo');
      expect(getHiddenInput().value).toBe('Oslo');
      expect(events).toEqual(['input']);
    });
  });

  describe('VUE-81: the form state that the browser restores', () => {
    it('takes the hidden input at a `pageshow` event', async () => {
      const { container } = await render(<ComboboxRootBeforeHydration />);
      const fixture = within(container);
      const events = recordInputEvents(container);
      getHiddenInput().value = 'Oslo';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();
      await flushMicrotasks();

      expect(fixture.getByTestId('model').textContent).toBe('Oslo');
      expect(fixture.getByTestId('changes').textContent).toBe('Oslo (none)');
      expect(getHiddenInput().value).toBe('Oslo');
      expect(events).toEqual(['input']);
    });

    it('sends no event at a `pageshow` event for a value with a line feed', async () => {
      const { handleValueChange, events } = await renderAddresses('Main Street 1\nFlat 2');
      expect(getHiddenInput().value).toBe('Main Street 1Flat 2');

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(events).toEqual([]);
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(getOptions()).toEqual([]);
      expect(getHiddenInput().value).toBe('Main Street 1Flat 2');
    });

    it('takes an item that the browser restores into a combobox whose value has a line feed', async () => {
      const { handleValueChange, events } = await renderAddresses('Main Street 1\nFlat 2');
      getHiddenInput().value = 'Box 1';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();
      await flushMicrotasks();

      expect(handleValueChange.mock.calls.map((call) => [call[0], call[1].reason])).toEqual([
        ['Box 1', 'none'],
      ]);
      expect(getInput().value).toBe('Box 1');
      expect(getHiddenInput().value).toBe('Box 1');
      expect(events).toEqual(['input']);
    });

    it('sends no event at a `pageshow` event after a change of the controlled value', async () => {
      const value = shallowRef<string | null>('Main Street 1\nFlat 2');
      const { container } = await render(() => (
        <Combobox.Root name="address" items={addresses} modelValue={value.value}>
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>
      ));
      value.value = 'Box 1';
      await flushMicrotasks();
      const events = recordInputEvents(container);
      expect(getHiddenInput().value).toBe('Box 1');

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(events).toEqual([]);
      expect(getOptions()).toEqual([]);
    });

    it('sends no event at a `pageshow` event after an autofill that matches no item', async () => {
      const { container } = await render(
        <Combobox.Root name="address" items={addresses} defaultValue="Box 1">
          <ComboboxInputPart />
          <ComboboxListPart />
        </Combobox.Root>,
      );
      getHiddenInput().value = 'Nowhere';
      getHiddenInput().dispatchEvent(new Event('input', { bubbles: true }));
      await flushMicrotasks();
      expect(getHiddenInput().value).toBe('Box 1');
      const events = recordInputEvents(container);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(events).toEqual([]);
    });

    it('keeps the text of an autocomplete with a line feed at a `pageshow` event', async () => {
      const handleValueChange = vi.fn();
      const { container } = await render(
        <form data-testid="form">
          <Autocomplete.Root
            name="address"
            items={addresses}
            defaultValue={'Main Street 1\nFlat 2'}
            onValueChange={handleValueChange}
          >
            <ComboboxInputPart />
          </Autocomplete.Root>
        </form>,
      );
      const events = recordInputEvents(container);
      expect(getHiddenInput().value).toBe('Main Street 1Flat 2');

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(events).toEqual([]);
      expect(handleValueChange).not.toHaveBeenCalled();
    });
  });

  describe('VUE-102: a value with a line break', () => {
    it('submits the value with a line feed', async () => {
      await renderAddresses('Main Street 1\nFlat 2');

      expect(getHiddenInput().value).toBe('Main Street 1Flat 2');
      expect(getFormData('address')).toEqual(['Main Street 1\nFlat 2']);
    });

    it('selects the item whose value gives the text that the browser restores', async () => {
      const { handleValueChange, events } = await renderAddresses('Box 1');
      getHiddenInput().value = 'Main Street 1Flat 2';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();
      await flushMicrotasks();

      expect(handleValueChange.mock.calls.map((call) => [call[0], call[1].reason])).toEqual([
        ['Main Street 1\nFlat 2', 'none'],
      ]);
      expect(getOptions()).toEqual([]);
      expect(getFormData('address')).toEqual(['Main Street 1\nFlat 2']);
      expect(events).toEqual(['input']);
    });
  });

  describe('selection behavior', () => {
    describe('single', () => {
      it('fires onOpenChange once with reason item-press on mouse click', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = vi.fn();

        const { user } = await render(
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
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
        await waitForLaterMillisecond(() => user.click(input));
        expect(screen.getByRole('listbox')).not.toBe(null);

        onOpenChange.mockClear();
        await user.click(screen.getByRole('option', { name: 'apple' }));

        expect(screen.queryByRole('listbox')).toBe(null);

        expect(onOpenChange.mock.calls.length).toBe(1);
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(onOpenChange.mock.lastCall?.[1].event instanceof MouseEvent).toBe(true);
      });

      it('fires onOpenChange once with reason item-press on Enter selection', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = vi.fn();

        const { user } = await render(
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
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
        await waitForLaterMillisecond(async () => {
          await user.click(input);
          await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
        });

        await user.keyboard('{ArrowDown}');
        onOpenChange.mockClear();
        await user.keyboard('{Enter}');

        expect(screen.queryByRole('listbox')).toBe(null);

        expect(onOpenChange.mock.calls.length).toBe(1);
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(onOpenChange.mock.lastCall?.[1].event instanceof KeyboardEvent).toBe(true);
      });

      it('should auto-close popup after selection when open state is uncontrolled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = await render(
          <Combobox.Root items={items}>
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
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');
        await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          expect(await screen.findByRole('listbox')).not.toBe(null);
        });
        expect(input).toHaveAttribute('aria-expanded', 'true');

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        expect(screen.queryByRole('listbox')).toBe(null);
        expect(input).toHaveAttribute('aria-expanded', 'false');
      });

      it('syncs selected index when items change after close', async () => {
        const { user } = await render(<AsyncItemsCombobox />);

        const input = screen.getByTestId('input');
        await waitForLaterMillisecond(async () => {
          await user.click(input);
          await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
        });

        await user.click(screen.getByRole('option', { name: 'Cherry' }));
        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        const cherryOption = screen.getByRole('option', { name: 'Cherry' });
        expect(cherryOption).toHaveAttribute('data-selected', '');
      });

      it('should not auto-close popup when open state is controlled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = await render(
          <Combobox.Root items={items} open>
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
          </Combobox.Root>,
        );

        await user.click(screen.getByText('apple'));
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      it('should show all items when query is empty with enhanced filter', async () => {
        const items = ['apple', 'banana', 'cherry'];

        await render(
          <Combobox.Root items={items} defaultOpen>
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

        expect(screen.queryByText('apple')).not.toBe(null);
        expect(screen.queryByText('banana')).not.toBe(null);
        expect(screen.queryByText('cherry')).not.toBe(null);
      });

      it('should show all items when query matches current selection', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = await render(
          <Combobox.Root items={items} defaultValue="apple">
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
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        const appleOption = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByText('apple');
        });
        await user.click(appleOption);

        expect(input).toHaveValue('apple');

        await user.click(trigger);

        expect(await screen.findByText('apple')).not.toBe(null);
        expect(await screen.findByText('banana')).not.toBe(null);
        expect(await screen.findByText('cherry')).not.toBe(null);
      });

      it('should reset input value to selected value when popup closes without selection', async () => {
        const items = ['apple', 'banana', 'cherry'];
        const onInputValueChange = vi.fn();

        const { user } = await render(
          <Combobox.Root items={items} defaultValue="apple" onInputValueChange={onInputValueChange}>
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
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        const appleOption = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByText('apple');
        });
        await user.click(appleOption);

        expect(input).toHaveValue('apple');

        await user.click(trigger);
        await user.type(input, 'xyz');
        expect(input).toHaveValue('applexyz');

        await user.click(document.body);

        await waitFor(() => expect(input).toHaveValue('apple'));
        expect(onInputValueChange.mock.lastCall?.[0]).toBe('apple');
        expect(onInputValueChange.mock.lastCall?.[1].reason).toBe('none');
      });

      it('should not auto-close during browser autofill', async () => {
        const items = ['apple', 'banana', 'cherry'];

        await render(
          <Combobox.Root items={items} name="test" defaultOpen>
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

        expect(screen.getByRole('listbox')).not.toBe(null);

        const hiddenInput = screen.queryByRole('textbox', { hidden: true });
        await fireEvent.input(hiddenInput!, { target: { value: 'apple' } });

        await flushMicrotasks();

        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      it.skipIf(isJSDOM)(
        'highlights and scrolls the selected item into view on first open (no items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          const { user } = await render(
            <Combobox.Root defaultValue="banana">
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
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

          const input = screen.getByTestId('input');
          await user.click(input);

          const selectedItem = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
          await waitFor(() => {
            expect(scrollIntoView.mock.contexts).toEqual([selectedItem]);
          });
          expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
        },
      );

      it.skipIf(isJSDOM)(
        'highlights and scrolls the selected item into view on mount when inline (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          await render(
            <Combobox.Root items={['apple', 'banana', 'cherry']} inline open defaultValue="banana">
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
          const selectedItem = await screen.findByRole('option', { name: 'banana' });

          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
          await waitFor(() => {
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
          });
        },
      );

      it.skipIf(isJSDOM)(
        'does not restore the initial highlight after focus leaves an inline input (items prop)',
        async () => {
          const App = defineComponent(() => {
            const value = shallowRef<string | null>('banana');

            return () => (
              <Combobox.Root
                items={['apple', 'banana', 'cherry']}
                inline
                open
                modelValue={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
              >
                <Combobox.Input data-testid="input" />
                <button type="button" onClick={() => (value.value = 'cherry')}>
                  Change value
                </button>
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
          const input = screen.getByTestId('input');
          const banana = await screen.findByRole('option', { name: 'banana' });

          await waitFor(() => {
            expect(banana).toHaveAttribute('data-highlighted');
          });

          await user.click(input);
          await user.click(screen.getByRole('button', { name: 'Change value' }));

          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
            'data-highlighted',
          );
        },
      );

      it.skipIf(isJSDOM)(
        'does not apply the initial highlight when a selection resolves after blur (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          const App = defineComponent(() => {
            const value = shallowRef<string | null>(null);

            return () => (
              <>
                <Combobox.Root
                  items={['apple', 'banana', 'cherry']}
                  inline
                  open
                  modelValue={value.value}
                  onValueChange={(next) => {
                    value.value = next;
                  }}
                >
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
                </Combobox.Root>
                <button type="button">Blur target</button>
                <button type="button" onClick={() => (value.value = 'banana')}>
                  Resolve selection
                </button>
              </>
            );
          });

          const { user } = await render(<App />);
          const input = screen.getByTestId('input');

          await user.click(input);
          await user.click(screen.getByRole('button', { name: 'Blur target' }));
          await user.click(screen.getByRole('button', { name: 'Resolve selection' }));

          const selectedItem = screen.getByRole('option', { name: 'banana' });
          expect(selectedItem).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(scrollIntoView).not.toHaveBeenCalled();
        },
      );

      it.skipIf(isJSDOM)(
        'does not snap the highlight to a stale index while filtering an inline list (items prop)',
        async () => {
          // The selected item survives filtering but shifts index: `banana` is at unfiltered
          // index 1, but after typing `b` the visible list is `[banana, blueberry]` so index 1
          // is `blueberry`. Recomputing the frozen selected index against the unfiltered list
          // would highlight `blueberry`.
          const { user } = await render(
            <Combobox.Root
              items={['apple', 'banana', 'blueberry', 'cherry']}
              inline
              open
              defaultValue="banana"
            >
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
          const banana = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => {
            expect(banana).toHaveAttribute('data-highlighted');
          });

          await user.click(input);
          await user.keyboard('b');

          expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);

          // Typing without `autoHighlight` clears the highlight; it must not be re-derived from
          // a stale unfiltered index onto a different item.
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(screen.getByRole('option', { name: 'blueberry' })).not.toHaveAttribute(
            'data-highlighted',
          );
        },
      );

      it.skipIf(isJSDOM)(
        'does not transfer a stale highlight when clearing an inline list without a selection (items prop)',
        async () => {
          const { user } = await render(
            <Combobox.Root items={['apple', 'banana', 'blueberry', 'cherry']} inline open>
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
          await user.type(input, 'b');
          await user.keyboard('{ArrowDown}{ArrowDown}');

          const blueberry = screen.getByRole('option', { name: 'blueberry' });
          await waitFor(() => {
            expect(blueberry).toHaveAttribute('data-highlighted');
          });

          await user.clear(input);

          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
            'data-highlighted',
          );
        },
      );

      it.skipIf(isJSDOM)(
        'waits for a controlled query clear to commit before restoring the selection (items prop)',
        async () => {
          const App = defineComponent(() => {
            const renders = shallowRef(0);

            return () => {
              // The button changes `renders`, so `App` and the root render again.
              void renders.value;

              return (
                <Combobox.Root
                  items={['apple', 'banana', 'blueberry', 'cherry']}
                  defaultValue="banana"
                  inputValue="b"
                  onInputValueChange={() => {}}
                  defaultOpen
                >
                  <Combobox.Portal>
                    <Combobox.Positioner>
                      <Combobox.Popup>
                        <Combobox.Input data-testid="input" />
                        <ClearActiveIndexButton />
                        <button
                          type="button"
                          onClick={() => {
                            renders.value++;
                          }}
                        >
                          Rerender
                        </button>
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
            };
          });

          const { user } = await render(<App />);
          const input = screen.getByTestId('input');
          const banana = await screen.findByRole('option', { name: 'banana' });

          await user.click(screen.getByRole('button', { name: 'Clear highlight' }));
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(banana).not.toHaveAttribute('data-highlighted');

          await user.clear(input);
          expect(input).toHaveValue('b');
          expect(banana).not.toHaveAttribute('data-highlighted');

          await user.click(screen.getByRole('button', { name: 'Rerender' }));
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(banana).not.toHaveAttribute('data-highlighted');
        },
      );

      it.skipIf(isJSDOM)(
        'highlights the first selected item on mount and keeps the highlight when toggling in a multiple inline list (items prop)',
        async () => {
          const { user } = await render(
            <Combobox.Root
              items={['apple', 'banana', 'cherry', 'date', 'elderberry']}
              inline
              open
              multiple
              defaultValue={['apple', 'date']}
            >
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
          const date = await screen.findByRole('option', { name: 'date' });
          const apple = screen.getByRole('option', { name: 'apple' });

          // Initial highlight follows the first selected value in rendered order.
          await waitFor(() => {
            expect(apple).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', apple.id);
          });

          // Deselecting must not jump the highlight (and scroll) to the other selected item.
          await moveOver(date);
          await user.click(date);

          await waitFor(() => {
            expect(date).toHaveAttribute('aria-selected', 'false');
          });
          expect(apple).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant', apple.id);
        },
      );

      it.skipIf(isJSDOM)(
        'does not highlight a non-selected item when an initial input value pre-filters the inline list (items prop)',
        async () => {
          // The selected value is filtered out by the initial input value, but its unfiltered
          // index stays in range of the filtered list. Resolving that index against the
          // unfiltered list would highlight whichever item now occupies that slot.
          await render(
            <Combobox.Root
              items={['b0', 'sel', 'b1', 'b2', 'b3']}
              inline
              open
              defaultValue="sel"
              defaultInputValue="b"
            >
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
          const b1 = await screen.findByRole('option', { name: 'b1' });
          expect(screen.queryByRole('option', { name: 'sel' })).toBe(null);

          expect(b1).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant');
        },
      );

      it.skipIf(isJSDOM)(
        'does not replace a pointer highlight when the initial selection resolves after mount (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          const { setProps, user } = await render(
            <Combobox.Root items={['apple', 'cherry']} inline open defaultValue="banana">
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
          const apple = await screen.findByRole('option', { name: 'apple' });
          await user.hover(apple);
          await moveOver(apple);

          await waitFor(() => {
            expect(apple).toHaveAttribute('data-highlighted');
          });

          await setProps({ items: ['apple', 'banana', 'cherry'] });
          await waitSingleFrame();

          expect(apple).toHaveAttribute('data-highlighted');
          expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
            'data-highlighted',
          );
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
          expect(scrollIntoView).not.toHaveBeenCalled();
        },
      );

      it.skipIf(isJSDOM)(
        'does not restore the initial highlight after pointer navigation is cleared (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          const { setProps, user } = await render(
            <Combobox.Root items={['apple', 'cherry']} inline open defaultValue="banana">
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
          const apple = await screen.findByRole('option', { name: 'apple' });
          await user.hover(apple);
          await moveOver(apple);
          // A `pointerleave` resets the highlight only after a `pointermove` with movement.
          await fireEvent.pointerMove(apple, { pointerType: 'mouse', movementX: 1 });

          await waitFor(() => {
            expect(apple).toHaveAttribute('data-highlighted');
          });

          await user.unhover(apple);
          expect(apple).not.toHaveAttribute('data-highlighted');

          scrollIntoView.mockClear();
          await setProps({ items: ['apple', 'banana', 'cherry'] });

          expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
            'data-highlighted',
          );
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(scrollIntoView).not.toHaveBeenCalled();
        },
      );

      it.skipIf(isJSDOM)(
        'emits the selected item index to onItemHighlighted on mount when inline and virtualized (items prop)',
        async () => {
          const onItemHighlighted = vi.fn();
          const items = Array.from({ length: 50 }, (_, index) => `item-${index}`);

          await render(
            <Combobox.Root
              items={items}
              inline
              open
              virtualized
              defaultValue="item-30"
              onItemHighlighted={onItemHighlighted}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {items.map((item, index) => (
                  <Combobox.Item key={item} value={item} index={index}>
                    {item}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Root>,
          );

          await waitFor(() => {
            expect(onItemHighlighted).toHaveBeenCalledWith(
              'item-30',
              expect.objectContaining({ index: 30 }),
            );
          });
        },
      );

      it.skipIf(isJSDOM)(
        'restores the highlight and scroll to the selected item when the query is cleared',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          const { user } = await render(
            <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="banana">
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

          const input = await waitForLaterMillisecond(async () => {
            await user.click(screen.getByTestId('trigger'));
            return screen.findByTestId('input');
          });

          // Move the highlight away from the selected item by filtering.
          await user.type(input, 'cherry');
          expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);

          scrollIntoView.mockClear();

          // Clearing the query should restore the highlight to the selected item.
          await user.clear(input);

          const selectedItem = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
          await waitFor(() => {
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
          });
        },
      );

      it.skipIf(isJSDOM)(
        'restores the selected direct item after its registration index changes',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi
            .spyOn(HTMLElement.prototype, 'scrollIntoView')
            .mockImplementation(() => {});
          onTestFinished(() => scrollIntoView.mockRestore());

          const onItemHighlighted = vi.fn();

          const App = defineComponent(() => {
            const query = shallowRef('');
            const visibleItems = computed(() =>
              query.value ? ['cherry'] : ['apple', 'banana', 'cherry'],
            );

            return () => (
              <Combobox.Root
                onInputValueChange={(next) => {
                  query.value = next;
                }}
                defaultValue="banana"
                defaultOpen
                autoHighlight
                onItemHighlighted={onItemHighlighted}
              >
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.Input data-testid="input" />
                      <Combobox.List>
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

          const { user } = await render(<App />);
          const input = screen.getByTestId('input');

          await user.type(input, 'c');
          const cherry = await screen.findByRole('option', { name: 'cherry' });
          await moveOver(cherry);
          await waitFor(() => expect(cherry).toHaveAttribute('data-highlighted'));
          await waitSingleFrame();

          scrollIntoView.mockClear();
          onItemHighlighted.mockClear();
          await user.clear(input);

          const banana = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
          await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', banana.id));
          // Interim registrations may scroll transiently before paint; the final scroll
          // must land on the restored selected item.
          await waitFor(() => expect(scrollIntoView.mock.contexts.at(-1)).toBe(banana));
          expect(scrollIntoView.mock.lastCall).toEqual([{ block: 'nearest', inline: 'nearest' }]);
          expect(onItemHighlighted.mock.lastCall?.[0]).toBe('banana');

          // The restore must never report an item at an index it does not occupy: the
          // re-mounted items publish their real indices a commit later, so reading the
          // registry too early pairs the selected item with a stale index.
          const positions: Record<string, number> = { apple: 0, banana: 1, cherry: 2 };
          const inconsistent = onItemHighlighted.mock.calls
            .filter(([item]) => item != null)
            .filter(([item, details]) => positions[item] !== details.index)
            .map(([item, details]) => `${item}@${details.index}`);
          expect(inconsistent).toEqual([]);
        },
      );

      it('does not navigate kept-mounted items while controlled closed', async () => {
        const { user } = await render(
          <Combobox.Root items={['apple', 'banana']} open={false} autoHighlight>
            <Combobox.Input data-testid="input" />
            <ActiveIndexProbe />
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

        await user.type(screen.getByTestId('input'), 'banana');

        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(screen.getByTestId('input')).not.toHaveAttribute('aria-activedescendant');
      });

      it('restores the selected item with the input outside the popup', async () => {
        const { user } = await render(
          <Combobox.Root items={['apple', 'banana', 'cherry']} modelValue="banana" defaultOpen>
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
        await user.type(input, 'cherry');
        expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);

        await user.clear(input);

        const banana = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
        expect(input).toHaveAttribute('aria-activedescendant', banana.id);
      });

      it.skipIf(isJSDOM)(
        'scrolls to programmatic highlights after the filtered list changes',
        async () => {
          const items = Array.from(
            { length: 200 },
            (_, index) => `item-${String(index).padStart(3, '0')}`,
          );
          const { user } = await render(
            <Combobox.Root items={items} defaultValue="item-180" autoHighlight>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <Combobox.List
                      data-testid="list"
                      style={{ maxHeight: '100px', overflow: 'auto' }}
                    >
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

          const input = await waitForLaterMillisecond(async () => {
            await user.click(screen.getByTestId('trigger'));
            return screen.findByTestId('input');
          });
          const list = screen.getByTestId('list');
          list.scrollTop = list.scrollHeight;

          await user.type(input, '9');

          const firstMatch = await screen.findByRole('option', { name: 'item-009' });
          await waitFor(() => {
            expect(firstMatch).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(list.scrollTop).toBe(0);
          });

          list.scrollTop = list.scrollHeight;
          await user.clear(input);

          const selectedItem = await screen.findByRole('option', { name: 'item-180' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            const listRect = list.getBoundingClientRect();
            const selectedRect = selectedItem.getBoundingClientRect();
            expect(selectedRect.top >= listRect.top && selectedRect.bottom <= listRect.bottom).toBe(
              true,
            );
          });
        },
      );

      it('restores the selected item instead of the first item when clearing with autoHighlight', async () => {
        const { user } = await render(
          <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="banana" autoHighlight>
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

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });

        // With autoHighlight, filtering strongly highlights the first match.
        await user.type(input, 'a');
        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });

        // Clearing should return the highlight to the selected item, not the first item.
        await user.clear(input);

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('emits onItemHighlighted for the selected item when the query is cleared', async () => {
        const onItemHighlighted = vi.fn();

        const { user } = await render(
          <Combobox.Root
            items={['apple', 'banana', 'cherry']}
            defaultValue="banana"
            onItemHighlighted={onItemHighlighted}
          >
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

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });

        await user.type(input, 'cherry');
        onItemHighlighted.mockClear();

        await user.clear(input);

        // The consumer receives a programmatic (`none`) highlight for the selected item,
        // which virtualized lists rely on to scroll it into view.
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'banana',
            expect.objectContaining({ reason: REASONS.none, index: 1 }),
          );
        });
      });

      it.skipIf(isJSDOM)(
        'restores the selected item through an externally virtualized list',
        async () => {
          const items = Array.from(
            { length: 100 },
            (_, index) => `item-${String(index).padStart(3, '0')}`,
          );
          const scrollToIndex = vi.fn();

          const VirtualizedItems = defineComponent({
            props: {
              windowStart: { type: Number, required: true },
              setWindowStart: {
                type: Function as PropType<(next: number) => void>,
                required: true,
              },
            },
            setup(props) {
              const filteredItems = Combobox.useFilteredItems<string>();

              watch(
                () => filteredItems.value.length,
                (length) => {
                  if (length < items.length) {
                    props.setWindowStart(0);
                  }
                },
              );

              return () =>
                filteredItems.value
                  .slice(props.windowStart, props.windowStart + 10)
                  .map((item, offset) => (
                    <Combobox.Item key={item} value={item} index={props.windowStart + offset}>
                      {item}
                    </Combobox.Item>
                  ));
            },
          });

          const App = defineComponent(() => {
            const windowStart = shallowRef(80);

            return () => (
              <Combobox.Root
                items={items}
                defaultValue="item-080"
                virtualized
                onItemHighlighted={(item, { index }) => {
                  if (item) {
                    scrollToIndex(index);
                    queueMicrotask(() => (windowStart.value = index));
                  }
                }}
              >
                <Combobox.Trigger data-testid="trigger">
                  <Combobox.Value />
                </Combobox.Trigger>
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.Input data-testid="input" />
                      <Combobox.List>
                        <VirtualizedItems
                          windowStart={windowStart.value}
                          setWindowStart={(next) => {
                            windowStart.value = next;
                          }}
                        />
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            );
          });

          const { user } = await render(<App />);
          const input = await waitForLaterMillisecond(async () => {
            await user.click(screen.getByTestId('trigger'));
            return screen.findByTestId('input');
          });

          await user.type(input, 'item-000');
          await screen.findByRole('option', { name: 'item-000' });
          scrollToIndex.mockClear();

          await user.clear(input);

          await waitFor(() => {
            expect(scrollToIndex).toHaveBeenCalledWith(80);
          });
          const selectedItem = await screen.findByRole('option', { name: 'item-080' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
        },
      );

      it('consumes a query-clear restore when the selected item is absent', async () => {
        const onItemHighlighted = vi.fn();
        const App = defineComponent(() => {
          const inputValue = shallowRef('');
          const includeSelected = shallowRef(true);
          const visibleItems = computed(() => {
            if (inputValue.value) {
              return ['apple'];
            }
            return includeSelected.value ? ['apple', 'banana', 'cherry'] : ['apple', 'cherry'];
          });

          return () => (
            <Combobox.Root
              inputValue={inputValue.value}
              onInputValueChange={(next) => {
                inputValue.value = next;
              }}
              defaultValue="banana"
              defaultOpen
              autoHighlight
              onItemHighlighted={onItemHighlighted}
            >
              <ActiveIndexProbe />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <button type="button" onClick={() => (includeSelected.value = false)}>
                      Remove selected item
                    </button>
                    <Combobox.List>
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

        const { user } = await render(<App />);
        const input = screen.getByTestId('input');
        await user.type(input, 'a');
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });

        await fireEvent.click(screen.getByRole('button', { name: 'Remove selected item' }));
        onItemHighlighted.mockClear();
        await user.clear(input);
        await waitFor(() => {
          expect(screen.getAllByRole('option')).toHaveLength(2);
        });
        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(onItemHighlighted.mock.calls.some(([item]) => item === 'banana')).toBe(false);
      });

      it('clears selectedIndex when the value is cleared externally while closed (no items prop)', async () => {
        const App = defineComponent(() => {
          const value = shallowRef<string | null>('banana');

          return () => (
            <div>
              <Combobox.Root
                modelValue={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
              >
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button
                type="button"
                data-testid="external-clear"
                onClick={() => (value.value = null)}
              >
                Clear
              </button>
            </div>
          );
        });

        const { user } = await render(<App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(screen.getByTestId('external-clear'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      it('clears selectedIndex when the value is set to an unmatched value while closed (no items prop)', async () => {
        const App = defineComponent(() => {
          const value = shallowRef<string | null>('banana');

          return () => (
            <div>
              <Combobox.Root
                modelValue={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
              >
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button
                type="button"
                data-testid="external-set"
                onClick={() => (value.value = 'dragonfruit')}
              >
                Set
              </button>
            </div>
          );
        });

        const { user } = await render(<App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(screen.getByTestId('external-set'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      it('registers selectedIndex before opening with a keepMounted portal (no items prop)', async () => {
        function App() {
          return (
            <Combobox.Root defaultValue="banana">
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <Combobox.Portal keepMounted>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="apple">apple</Combobox.Item>
                      <Combobox.Item value="banana">banana</Combobox.Item>
                      <Combobox.Item value="cherry">cherry</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        await render(<App />);

        // The portal mounts its children in a second commit, so the index is
        // asserted by the mounted item itself while still closed.
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });
      });

      it('does not highlight the previous item after the value changes while open (no items prop)', async () => {
        const onItemHighlighted = vi.fn();

        const App = defineComponent(() => {
          const value = shallowRef<string | null>('banana');

          return () => (
            <div>
              <Combobox.Root
                modelValue={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
                onItemHighlighted={onItemHighlighted}
              >
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button
                type="button"
                data-testid="external-set"
                onClick={() => (value.value = 'cherry')}
              >
                Set
              </button>
            </div>
          );
        });

        const { user } = await render(<App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        // Change the value externally while the popup is open. `fireEvent` avoids the
        // outside-press dismiss a real pointer interaction would trigger.
        await fireEvent.click(screen.getByTestId('external-set'));
        await flushMicrotasks();
        expect(screen.getByRole('listbox')).not.toBe(null);

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBe(null);
        // Closing reconciles the index to the new selection (cherry).
        expect(screen.getByTestId('selected-index').textContent).toBe('2');

        onItemHighlighted.mockClear();
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(
          onItemHighlighted.mock.calls.some(([highlightedValue]) => highlightedValue === 'banana'),
        ).toBe(false);
      });

      it('re-highlights the selection on reopen when the value object is recreated with equal contents (no items prop)', async () => {
        const onItemHighlighted = vi.fn();
        const apple = { id: 1, label: 'apple' };
        const banana = { id: 2, label: 'banana' };
        const cherry = { id: 3, label: 'cherry' };
        const isItemEqualToValue = (a: any, b: any) => a.id === b.id;

        const App = defineComponent(() => {
          const renders = shallowRef(0);
          // The render function makes the value object again in each render (same id).
          return () => (
            <div>
              <Combobox.Root
                modelValue={{ id: 2, label: 'banana' }}
                isItemEqualToValue={isItemEqualToValue}
                onItemHighlighted={onItemHighlighted}
                itemToStringLabel={(v: any) => v.label}
              >
                <Combobox.Input data-testid="input" />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value={apple}>apple</Combobox.Item>
                        <Combobox.Item value={banana}>banana</Combobox.Item>
                        <Combobox.Item value={cherry}>cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button
                type="button"
                data-testid="force"
                data-render={renders.value}
                onClick={() => {
                  renders.value++;
                }}
              >
                force
              </button>
            </div>
          );
        });

        const { user } = await render(<App />);
        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBe(null);

        // Rerender while closed so the value object is recreated with the same id.
        await fireEvent.click(screen.getByTestId('force'));
        await flushMicrotasks();

        onItemHighlighted.mockClear();
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
            'data-highlighted',
          );
        });
        expect(onItemHighlighted.mock.calls.some(([v]) => v?.id !== undefined && v.id !== 2)).toBe(
          false,
        );
      });
    });

    describe('multiple', () => {
      it('should handle multiple selection', async () => {
        const handleValueChange = vi.fn();

        const { user } = await render(
          <Combobox.Root multiple onValueChange={handleValueChange}>
            <Combobox.Input />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
              <Combobox.Item value="c">c</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>,
        );

        const optionA = screen.getByRole('option', { name: 'a' });
        await user.click(optionA);

        expect(handleValueChange.mock.calls.length).toBe(1);
        expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);

        const optionB = screen.getByRole('option', { name: 'b' });
        await user.click(optionB);

        expect(handleValueChange.mock.calls.length).toBe(2);
        expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b']);
      });

      it('opens with an empty input and highlights the first selected item (input inside popup)', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = await render(
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />,
        );

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });
        const bananaItem = screen.getByRole('option', { name: 'banana' });

        expect(input).toHaveValue('');
        expect(appleItem).toHaveAttribute('aria-selected', 'true');
        expect(bananaItem).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
      });

      it('anchors the highlight to the first selected item in rendered order regardless of value order', async () => {
        // `apple` renders first but sits in the middle of the value array, so neither end of
        // that array points at it and only the rendered order does.
        const { user } = await render(
          <MultiplePopupCombobox defaultValue={['banana', 'apple', 'cherry']} />,
        );

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors the highlight to the first selected item with individually rendered items', async () => {
        const { user } = await render(
          <Combobox.Root multiple defaultValue={['banana', 'apple', 'cherry']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {['apple', 'banana', 'cherry'].map((item) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ))}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        await user.click(input);
        const appleItem = await screen.findByRole('option', { name: 'apple' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors to the first selected item in rendered order across groups', async () => {
        // `spinach` renders first but is not the last value, so anchoring to the rendered order
        // and anchoring to the end of the value array give different answers.
        const { user } = await render(
          <Combobox.Root multiple defaultValue={['spinach', 'plum']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Group>
                      <Combobox.GroupLabel>Vegetables</Combobox.GroupLabel>
                      <Combobox.Item value="artichoke">artichoke</Combobox.Item>
                      <Combobox.Item value="spinach">spinach</Combobox.Item>
                    </Combobox.Group>
                    <Combobox.Group>
                      <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
                      <Combobox.Item value="apple">apple</Combobox.Item>
                      <Combobox.Item value="plum">plum</Combobox.Item>
                    </Combobox.Group>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const input = screen.getByTestId('input');
        await user.click(input);

        const spinachItem = await screen.findByRole('option', { name: 'spinach' });
        await waitFor(() => {
          expect(spinachItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', spinachItem.id);
        });
        expect(screen.getByRole('option', { name: 'plum' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('keeps the highlight on an item a controlled value refused to select', async () => {
        // A controlled consumer may decline the change without calling `cancel()`. The query
        // still clears, and the highlight stays on the item that was pressed, matching what
        // happens when the same item is pressed without a query active.
        const App = defineComponent(() => {
          const value = shallowRef(['apple']);
          return () => (
            <Combobox.Root
              items={['apple', 'banana', 'cherry']}
              multiple
              modelValue={value.value}
              onValueChange={() => {}}
            >
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
            </Combobox.Root>
          );
        });

        const { user } = await render(<App />);

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });

        await user.type(input, 'banana');
        expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);

        await user.click(screen.getByRole('option', { name: 'banana' }));
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors to the first selected item when opened with the keyboard', async () => {
        const { user } = await render(
          <MultiplePopupCombobox defaultValue={['banana', 'cherry']} />,
        );

        const trigger = screen.getByTestId('trigger');
        await user.keyboard('{Tab}');
        expect(trigger).toHaveFocus();
        await user.keyboard('{ArrowDown}');

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('continues arrow navigation from the anchor rather than the top of the list', async () => {
        const { user } = await render(
          <MultiplePopupCombobox defaultValue={['banana', 'cherry']} />,
        );

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });
        // Focus reaches the input asynchronously. Keys sent before it lands are lost.
        await waitFor(() => {
          expect(input).toHaveFocus();
        });
        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });

        // The next item after the anchor, not `apple` at the top.
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
      });

      it('keeps the toggled item highlighted when selecting with the keyboard while filtering', async () => {
        const { user } = await render(<MultiplePopupCombobox />);

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });

        await user.type(input, 'cherry');
        expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const cherryItem = await screen.findByRole('option', { name: 'cherry' });
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('moves the anchor when the anchor item value changes', async () => {
        function App(props: { replaceApple?: boolean }) {
          return (
            <Combobox.Root multiple defaultValue={['apple', 'cherry']}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <Combobox.Portal keepMounted>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value={props.replaceApple ? 'date' : 'apple'}>
                        {props.replaceApple ? 'date' : 'apple'}
                      </Combobox.Item>
                      <Combobox.Item value="banana">banana</Combobox.Item>
                      <Combobox.Item value="cherry">cherry</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { setProps } = await render(<App />);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await setProps({ replaceApple: true });

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
      });

      it('moves the anchor to the next selected item when the anchor item leaves the list', async () => {
        function App(props: { hideApple?: boolean }) {
          const visible = props.hideApple ? ['banana', 'cherry'] : ['apple', 'banana', 'cherry'];

          return (
            <Combobox.Root multiple defaultValue={['apple', 'cherry']}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <Combobox.Portal keepMounted>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {visible.map((item) => (
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
        }

        const { setProps } = await render(<App />);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await setProps({ hideApple: true });

        // `banana` now occupies index 0 but is not selected, so `cherry` takes the anchor.
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });
      });

      it('restores the anchor rather than the toggled item when deselecting while filtering', async () => {
        const { user } = await render(<MultiplePopupCombobox />);

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });

        await user.type(input, 'banana');
        expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);

        await user.click(screen.getByRole('option', { name: 'banana' }));
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByTestId('active-index')).toHaveTextContent('0');
      });

      it('restores the highlight to the first selected item when clearing (input inside popup)', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = await render(
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />,
        );

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });

        await user.type(input, 'banana');
        expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);

        onItemHighlighted.mockClear();
        await user.clear(input);

        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
        expect(onItemHighlighted).toHaveBeenCalledTimes(1);
      });

      it('keeps the popup open and highlights the newly selected item after clearing its query', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = await render(
          <MultiplePopupCombobox defaultValue={['apple']} onItemHighlighted={onItemHighlighted} />,
        );

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });
        await user.type(input, 'cherry');
        const cherryItem = await screen.findByRole('option', { name: 'cherry' });

        onItemHighlighted.mockClear();
        await user.click(cherryItem);

        await waitFor(() => {
          expect(input).toHaveValue('');
        });
        expect(screen.getByRole('listbox')).not.toBe(null);
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('aria-selected', 'true');
        });
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', cherryItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('2');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'cherry',
            expect.objectContaining({ reason: REASONS.none, index: 2 }),
          );
        });
      });

      it('keeps the toggled item highlighted when deselecting a selected item', async () => {
        const { user } = await render(<MultiplePopupCombobox />);

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });
        const appleItem = screen.getByRole('option', { name: 'apple' });
        const bananaItem = screen.getByRole('option', { name: 'banana' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await moveOver(bananaItem);
        await user.click(bananaItem);

        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        });
        expect(screen.getByRole('listbox')).not.toBe(null);
        expect(appleItem).toHaveAttribute('aria-selected', 'true');
        expect(appleItem).not.toHaveAttribute('data-highlighted');
        expect(bananaItem).toHaveAttribute('data-highlighted');
        expect(input).toHaveAttribute('aria-activedescendant', bananaItem.id);
        expect(screen.getByTestId('active-index')).toHaveTextContent('1');
      });

      it('clears the highlight when filtering deselects the only selected item', async () => {
        const { user } = await render(<MultiplePopupCombobox defaultValue={['banana']} />);

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });
        await user.type(input, 'banana');
        const bananaItem = await screen.findByRole('option', { name: 'banana' });

        await user.click(bananaItem);

        await waitFor(() => {
          expect(input).toHaveValue('');
        });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        });
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(
          screen.getAllByRole('option').some((item) => item.hasAttribute('data-highlighted')),
        ).toBe(false);
      });

      it('clears a closing query and restores the first selected item on reopen', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = await render(
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />,
        );

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });
        await user.type(input, 'cherry');
        expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBe(null);

        onItemHighlighted.mockClear();
        await user.click(screen.getByTestId('trigger'));

        const reopenedInput = await screen.findByTestId('input');
        const appleItem = await screen.findByRole('option', { name: 'apple' });
        expect(reopenedInput).toHaveValue('');
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(reopenedInput).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
      });

      it.skipIf(isJSDOM)(
        'scrolls the first selected item into view when clearing (input inside popup)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());
          const items = Array.from({ length: 100 }, (_, index) => `item ${index}`);
          const { user } = await render(
            <MultiplePopupCombobox items={items} defaultValue={['item 90', 'item 80']} />,
          );

          const input = await waitForLaterMillisecond(async () => {
            await user.click(screen.getByTestId('trigger'));
            return screen.findByTestId('input');
          });
          await user.type(input, 'item 0');
          expect(screen.queryByRole('option', { name: 'item 80' })).toBe(null);

          scrollIntoView.mockClear();
          await user.clear(input);

          const selectedItem = await screen.findByRole('option', { name: 'item 80' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(screen.getByTestId('active-index')).toHaveTextContent('80');
          });
          await waitFor(() => {
            expect(scrollIntoView.mock.contexts).toEqual([selectedItem]);
          });
          expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
        },
      );

      it('restores the highlight when clearing with the input outside the popup', async () => {
        const { user } = await render(
          <Combobox.Root
            items={['apple', 'banana', 'cherry']}
            multiple
            defaultValue={['apple', 'banana']}
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

        const input = screen.getByTestId('input');
        await user.click(input);
        await user.type(input, 'banana');
        expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);

        // Opening already highlights the first selected item in this layout, so clearing
        // the query returns to the same anchor.
        await user.clear(input);
        const apple = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
        expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      });

      it('resets selectedIndex when clearing all selections while open', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const App = defineComponent(() => {
          const value = shallowRef(items.slice(0, 2));

          return () => (
            <Combobox.Root
              items={items}
              multiple
              modelValue={value.value}
              onValueChange={(next) => {
                value.value = next;
              }}
            >
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="clear" onClick={() => (value.value = [])}>
                Clear
              </button>
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
        });

        const { user } = await render(<App />);

        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(screen.getByTestId('input'));

        expect(await screen.findByRole('listbox')).not.toBe(null);
        expect(screen.getByTestId('selected-index').textContent).toBe('0');

        await user.click(screen.getByTestId('clear'));

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });
      });

      it('re-syncs selectedIndex after an external controlled update when closing', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const App = defineComponent(() => {
          const value = shallowRef([items[0]]);

          return () => (
            <Combobox.Root
              items={items}
              multiple
              modelValue={value.value}
              onValueChange={(next) => {
                value.value = next;
              }}
            >
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button
                type="button"
                data-testid="set-external"
                onClick={() => (value.value = [items[2]])}
              >
                Set external
              </button>
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
        });

        const { user } = await render(<App />);

        const input = screen.getByTestId('input');
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await user.click(screen.getByTestId('set-external'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
      });

      it('clears selectedIndex when all values are removed externally while closed (no items prop)', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const App = defineComponent(() => {
          const value = shallowRef(items.slice(0, 2));

          return () => (
            <Combobox.Root
              multiple
              modelValue={value.value}
              onValueChange={(next) => {
                value.value = next;
              }}
            >
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="external-clear" onClick={() => (value.value = [])}>
                Clear
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {items.map((item) => (
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

        const { user } = await render(<App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(screen.getByTestId('external-clear'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('should create multiple hidden inputs for form submission', async () => {
        const items = ['a', 'b', 'c'];
        await render(
          <Combobox.Root multiple modelValue={items} name="languages">
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

        items.forEach((item) => {
          const input = screen.getByDisplayValue(item);
          expect(input).toHaveAttribute('type', 'hidden');
          expect(input.tagName).toBe('INPUT');
        });
      });

      it('does not submit multiple values when disabled', async () => {
        await render(
          <form data-testid="form">
            <Combobox.Root multiple disabled name="x" defaultValue={['a']}>
              <Combobox.Input />
            </Combobox.Root>
          </form>,
        );

        const form = screen.getByTestId<HTMLFormElement>('form');

        expect(new FormData(form).getAll('x')).toEqual([]);
      });

      it('should handle disabled state with chips', async () => {
        const { user } = await render(
          <Combobox.Root multiple disabled defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
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

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).toHaveAttribute('aria-disabled', 'true');
        expect(removeA).toHaveAttribute('aria-disabled', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.toBe(null);
      });

      it('should handle readOnly state with chips', async () => {
        const { user } = await render(
          <Combobox.Root multiple readOnly defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
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

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).toHaveAttribute('aria-readonly', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.toBe(null);
      });
    });
  });

  describe('keyboard interaction', () => {
    it('focuses first item on ArrowDown and last item on ArrowUp', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
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

      const input = screen.getByTestId('input');

      input.focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const first = screen.getByRole('option', { name: 'apple' });
        expect(input).toHaveAttribute('aria-activedescendant', first.id);
      });

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBe(null);

      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        const last = screen.getByRole('option', { name: 'cherry' });
        expect(input).toHaveAttribute('aria-activedescendant', last.id);
      });
    });

    it('opens, navigates with ArrowDown, and Enter selects', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Combobox.Root items={items}>
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

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });

      // Highlight first item and select it
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('apple');
    });

    it('Enter selects with manual indices provided to items', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Combobox.Root items={items}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item, index }: { item: string; index: number }) => (
                      <Combobox.Item key={item} value={item} index={index}>
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

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => {
          expect(screen.getByRole('listbox')).not.toBe(null);
        });
      });

      await user.type(input, 'c'); // filter to "cherry"
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('cherry');
      });
    });

    it('clicking on "listbox" keeps the focus on the input', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Combobox.Root items={items}>
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

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => {
          expect(screen.getByRole('listbox')).not.toBe(null);
        });
      });

      const listbox = screen.getByRole('listbox');
      await user.click(listbox);
      expect(input).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('apple');
      });
    });

    it('Escape closes the popup without committing when nothing highlighted', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen items={['a', 'b']}>
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
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('');
    });

    it('bubbles Escape key when rendered inline without Positioner/Popup', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = await render(
        <div
          data-testid="outer"
          onKeydown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root inline defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>
        </div>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(1);
    });

    it('keeps input value on Enter when inline and no item is highlighted', async () => {
      const { user } = await render(
        <Combobox.Root inline items={['Apple', 'Banana']}>
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

      await user.click(input);
      await user.type(input, 'Ba');

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(input).toHaveValue('Ba');

      await user.keyboard('{Enter}');

      expect(input).toHaveValue('Ba');
    });

    it('bubbles Escape key when list is empty and popup hidden with CSS', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = await render(
        <div
          onKeydown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
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

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(1);
    });

    it('does not bubble Escape key when Empty component is present', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = await render(
        <div
          onKeydown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
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
                  <Combobox.Empty>No results.</Combobox.Empty>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>,
      );

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(0);
    });
  });

  describe('aria attributes', () => {
    it('sets all aria attributes on the input when closed', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).not.toHaveAttribute('aria-controls');
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('sets all aria attributes on the input when open', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('sets aria-expanded on the input when rendered inline and open', async () => {
      await render(
        <Combobox.Root inline open>
          <Combobox.Input data-testid="input" />
          <Combobox.List />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
    });

    it('sets the popup type on the input when rendered inline as a grid', async () => {
      await render(
        <Combobox.Root inline open grid>
          <Combobox.Input data-testid="input" />
          <Combobox.List />
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const grid = screen.getByRole('grid');

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-haspopup', 'grid');
      expect(input).toHaveAttribute('aria-controls', grid.id);
    });

    it('keeps the input expanded when rendered inline without the `open` prop', async () => {
      const { user } = await render(
        <Combobox.Root inline items={['apple', 'banana']}>
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
      const listbox = screen.getByRole('listbox');

      // The list renders regardless of the internal open state, so the input must not claim
      // to be collapsed before it's interacted with.
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);

      await user.click(input);

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
    });

    it('sets correct attributes on the item when highlighted', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
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

      const input = screen.getByRole('combobox');

      await user.click(input);

      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'false');
      });
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'false');
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: 'a' }).id,
      );

      await user.keyboard('{Enter}');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'false');
    });

    it('sets aria-controls to the dialog popup on trigger', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('points aria-controls at a custom popup id on the trigger', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup id="custom-popup-id">
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-popup-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup-id');
    });

    it('points aria-controls at a popup id supplied through the render prop', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup
                v-slots={{
                  render: ({ props }: { props: HTMLProps }) => (
                    <div {...props} id="custom-render-id">
                      <Combobox.Input data-testid="input" />
                      <Combobox.List />
                    </div>
                  ),
                }}
              />
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-render-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-render-id');
    });
  });

  it('should handle browser autofill', async () => {
    const onInputValueChange = vi.fn();
    const { user } = await render(
      <Combobox.Root name="test" onInputValueChange={onInputValueChange}>
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

    await fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();
    expect(onInputValueChange.mock.lastCall?.[0]).toBe('b');
    expect(onInputValueChange.mock.lastCall?.[1].reason).toBe(REASONS.none);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it.each([
    { lockState: 'readOnly', label: 'inside Field', withField: true, expectedError: 'test' },
    { lockState: 'disabled', label: 'inside Field', withField: true, expectedError: 'test' },
    { lockState: 'readOnly', label: 'outside Field', withField: false, expectedError: null },
    { lockState: 'disabled', label: 'outside Field', withField: false, expectedError: null },
  ] as const)(
    'ignores hidden-input autofill when $lockState $label',
    async ({ lockState, withField, expectedError }) => {
      const onValueChange = vi.fn();
      const onInputValueChange = vi.fn();
      const combobox = (
        <Combobox.Root
          name={withField ? undefined : 'test'}
          readOnly={lockState === 'readOnly'}
          disabled={lockState === 'disabled'}
          onValueChange={onValueChange}
          onInputValueChange={onInputValueChange}
        >
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
      );

      await render(
        withField ? (
          <Form errors={{ test: 'test' }}>
            <Field.Root name="test">
              {combobox}
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ) : (
          combobox
        ),
      );

      const visibleInput = screen.getByTestId<HTMLInputElement>('input');
      const hiddenInput = screen
        .getAllByDisplayValue('')
        .find((el) => el.getAttribute('name') === 'test') as HTMLInputElement;
      expect(hiddenInput).not.toBeUndefined();
      expect(screen.queryByTestId('error')?.textContent ?? null).toBe(expectedError);

      await fireEvent.input(hiddenInput, { target: { value: 'b' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onInputValueChange).not.toHaveBeenCalled();
      expect(visibleInput.value).toBe('');
      expect(hiddenInput.value).toBe('');
      expect(screen.queryByTestId('error')?.textContent ?? null).toBe(expectedError);
    },
  );

  it('shows all items when opening after browser autofill', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = await render(
      <Combobox.Root name="test" items={items}>
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

    await fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'b' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
  });

  it('does not open or filter the popup on browser autofill with insertReplacementText', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = await render(
      <Combobox.Root name="test" items={items} defaultValue="b">
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

    // Firefox reports autofill on the visible input as `insertReplacementText`. The
    // autofilled text matches the selected label, so it must not count as a typed query
    // that filters the list once the popup opens.
    await fireEvent.input(input, { target: { value: 'B' }, inputType: 'insertReplacementText' });
    await flushMicrotasks();

    expect(input).toHaveValue('B');
    expect(screen.queryByRole('listbox')).toBe(null);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'b' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
  });

  it('should handle browser autofill with object values', async () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    await render(
      <Combobox.Root
        name="country"
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
                  item: ({ item }: { item: (typeof items)[1] }) => (
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

    await fireEvent.input(
      // getByRole('textbox', { hidden: true, name: 'country' }) does not work
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'CA' } },
    );
    await flushMicrotasks();

    await fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
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

    const onValueChange = vi.fn();

    await render(
      <Combobox.Root
        name="country"
        items={items}
        itemToStringLabel={(item: (typeof items)[number]) => item.country}
        itemToStringValue={(item: (typeof items)[number]) => item.code}
        onValueChange={onValueChange}
        defaultOpen
      >
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {{
                  item: ({ item }: { item: (typeof items)[1] }) => (
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

    // Simulate browser autofill with the LABEL (displayed text), not the value
    await fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'Canada' } }, // Browser sends "Canada" (label), not "CA" (value)
    );
    await flushMicrotasks();

    // onValueChange should be called with the matching object
    expect(onValueChange).toHaveBeenCalledWith(
      { country: 'Canada', code: 'CA' },
      expect.objectContaining({ reason: REASONS.none }),
    );

    await fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label for primitive values regardless of case', async () => {
    const { user } = await render(
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    // The browser autofills the rendered text ("Canada"), not the value ("CA").
    await fireEvent.input(hiddenInput, { target: { value: 'canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill by serialized value before an earlier rendered label', async () => {
    const { user } = await render(
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="CA">US</Combobox.Item>
                <Combobox.Item value="US">United States</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    await fireEvent.input(hiddenInput, { target: { value: 'US' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(screen.getByRole('option', { name: 'US' })).toHaveAttribute('aria-selected', 'false');
  });

  it('matches browser autofill when an earlier item has no rendered label', async () => {
    const { user } = await render(
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">{null}</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    await fireEvent.input(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label when using the items prop', async () => {
    const countryNames: Record<string, string> = {
      US: 'United States',
      CA: 'Canada',
    };

    const { user } = await render(
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {{
                  item: ({ item: code }: { item: string }) => (
                    <Combobox.Item key={code} value={code}>
                      {countryNames[code]}
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
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    await fireEvent.input(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('does not force-mount the list when autofill matches a serialized value with the items prop', async () => {
    const { user } = await render(
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {{
                  item: ({ item: code }: { item: string }) => (
                    <Combobox.Item key={code} value={code}>
                      {code}
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
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    await fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The serialized value matched directly, so the popup must not be force-mounted.
    expect(document.querySelector('[role="listbox"]')).toBe(null);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'CA' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('marks the field dirty and validates after successful autofill', async () => {
    const validateSpy = vi.fn((value: unknown) => {
      return value === 'CA' ? null : 'error';
    });

    await render(
      <Field.Root validationMode="onChange" validate={validateSpy}>
        <Combobox.Root name="country">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>,
    );

    const input = screen.getByTestId('input');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(input).not.toHaveAttribute('data-dirty');

    await fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
    });

    expect(validateSpy.mock.calls[validateSpy.mock.calls.length - 1][0]).toBe('CA');
    expect(input).toHaveAttribute('data-dirty', '');
  });

  it('does not update field state when autofill is canceled', async () => {
    await render(
      <Form errors={{ country: 'server error' }}>
        <Field.Root name="country">
          <Combobox.Root
            onValueChange={(_value, eventDetails) => {
              eventDetails.cancel();
            }}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="US">United States</Combobox.Item>
                    <Combobox.Item value="CA">Canada</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form>,
    );

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');

    await fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field keeps its state.
    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');
  });

  it('does not mark the field dirty when input autofill is canceled', async () => {
    await render(
      <Field.Root>
        <Combobox.Root
          name="country"
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
        >
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');

    await fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field stays pristine.
    expect(trigger).not.toHaveAttribute('data-dirty');
  });

  it('should pass autoComplete to the hidden input', async () => {
    await render(
      <Combobox.Root name="country" autoComplete="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen.getByRole('textbox', { hidden: true });

    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).not.toHaveAttribute('name');
    expect(hiddenInput).toHaveAttribute('name', 'country');
    expect(hiddenInput).not.toHaveAttribute('id');
    expect(hiddenInput).toHaveAttribute('autocomplete', 'country');
  });

  describe.skipIf(isJSDOM)('scroll locking', () => {
    describe('touch scroll lock', () => {
      it('applies scroll lock when a touch-opened popup covers the viewport width', async () => {
        await render(
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
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
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: '240px' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        await pressWithTouch(trigger);

        await screen.findByRole('listbox');

        await waitSingleFrame();
        // A lock comes in a 0 ms timer after the open.
        await wait(0);

        expect(isScrollLocked(trigger.ownerDocument)).toBe(false);
      });
    });
  });

  it('does not open on programmatic input events', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    await fireEvent.input(input, { target: { value: 'Darlinghurst' } });
    await flushMicrotasks();

    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('opens on paste input events', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    await fireEvent.input(input, {
      target: { value: 'Darlinghurst' },
      inputType: 'insertFromPaste',
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
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
      await waitSingleFrame();
      await flushMicrotasks();
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
      await waitSingleFrame();
      await flushMicrotasks();
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
        <Combobox.Root multiple required name="languages" modelValue={['a']}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists in multiple mode', async () => {
      await render(
        <Combobox.Root multiple required name="languages" modelValue={[]}>
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
      expect(screen.queryByRole('listbox')).toBe(null);

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
          modelValue={value}
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
        <Combobox.Root modelValue="banana">
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
        <Combobox.Root modelValue="apple" inputValue="x">
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
        <Combobox.Root items={items} modelValue={items[0]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      await setProps({ modelValue: items[1] });

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
              modelValue={withItems.value}
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
              modelValue={withoutItems.value}
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
        <Combobox.Root items={initialItems} modelValue={initialItems[0]}>
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

      await setProps({ items: nextItems, modelValue: nextItems[0] });
      expect(input).toHaveValue('Apricot');

      const sameLengthDifferentItems = [
        { value: 'a', label: 'Ambrosia' },
        { value: 'b', label: 'Blue Java' },
        { value: 'c', label: 'Clementine' },
      ];

      await setProps({ items: sameLengthDifferentItems, modelValue: sameLengthDifferentItems[0] });
      expect(input).toHaveValue('Ambrosia');
    });

    it('restores the selected label after a one-step clear and items reload', async () => {
      const itemToStringLabel = (item: string) => (item === 'apple' ? 'Apple' : item);
      const { setProps, user } = await render(
        <Combobox.Root items={['apple']} modelValue="apple" itemToStringLabel={itemToStringLabel}>
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
        <Combobox.Root items={items} modelValue={items[0]} onInputValueChange={onInputValueChange}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await setProps({ modelValue: items[1] });

      expect(input).toHaveValue('Banana');
      expect(onInputValueChange).toHaveBeenCalledTimes(1);

      await setProps({ modelValue: items[2] });

      expect(input).toHaveValue('Cherry');
      expect(onInputValueChange).toHaveBeenCalledTimes(2);

      await setProps({ modelValue: items[0] });

      expect(input).toHaveValue('Apple');
      expect(onInputValueChange).toHaveBeenCalledTimes(3);
    });

    it('syncs again after a canceled sync to the same label', async () => {
      let cancelSync = false;

      const App = defineComponent(
        (props: { value: string }) => () => (
          <Combobox.Root
            items={['One', 'Two']}
            modelValue={props.value}
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
            modelValue={value.value}
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
          <Combobox.Root
            items={['a', 'b']}
            modelValue="b"
            itemToStringLabel={props.itemToStringLabel}
          >
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
        <Combobox.Root items={[]} modelValue="banana">
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

      const input = await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('open'));
        return screen.findByTestId('input');
      });
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
      // The trigger opens the popup in the frame after the press. The press of `refetch` needs the
      // open popup.
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

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
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));

      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
      expect(popup).toHaveAttribute('data-ending-style');

      // Typing reopens the popup, so the keystroke's own "query changed" flag must survive
      // the reopen even when it restores the selected label exactly.
      await user.keyboard('e');
      await flushMicrotasks();

      expect(input).toHaveValue('apple');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
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
      // The trigger opens the popup in the frame after the press. The second Escape needs the open
      // popup.
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

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
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

      // The close request clears the input and freezes the query for the exit animation,
      // but the consumer keeps the popup open, so the frozen query must stop filtering.
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(input).toHaveValue('');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
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
              modelValue={value.value}
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

      const input = await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        return screen.findByTestId('input');
      });
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ap');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

      const apple = screen.getByRole('option', { name: 'apple' });
      const popup = screen.getByTestId('popup');
      await nextEvent(popup, 'animationstart', { action: () => user.click(apple) });
      expect(popup).toHaveAttribute('data-ending-style');

      // A consumer mirroring the selection into the popup input must not leave the reopened
      // list filtered by it: an interrupted close opens blank, same as a completed one.
      await user.click(screen.getByTestId('trigger'));

      const inputAfter = await screen.findByTestId('input');
      await waitFor(() => expect(inputAfter).toHaveValue(''));
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
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

      const input = await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        return screen.findByTestId('input');
      });
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ap');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

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
      const apple = await waitForLaterMillisecond(async () => {
        await user.type(input, 'ap');
        return screen.findByRole('option', { name: 'apple' });
      });

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
      await waitForLaterMillisecond(async () => {
        await user.type(input, 'app');
        await flushMicrotasks();
      });
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
      await waitForLaterMillisecond(() => user.type(input, 'app'));
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBe(null);
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
      await waitForLaterMillisecond(() => user.type(input, 'app'));
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
      const input = await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        return screen.findByTestId('input');
      });
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');

      // The cleanup clear that runs after the popup closes doesn't carry `isItemPress`, so the
      // recipe doesn't cancel it and the next open starts with a fresh filter.
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);

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
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByTestId('input');
        });
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
      const input = await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        return screen.findByTestId('input');
      });
      await user.type(input, 'app');
      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
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
      const input = await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        return screen.findByTestId('input');
      });
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
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(trigger).toHaveFocus();

      await user.click(trigger);

      const selectedOption = await screen.findByRole('option', { name: 'banana' });
      expect(screen.getByTestId('input')).toHaveValue('');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(selectedOption).toHaveAttribute('data-highlighted'));
    });

    it.skipIf(isJSDOM)(
      'keeps filtered popup content stable while closing with input inside popup',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const items = ['apple', 'apricot', 'banana'];
        const { user } = await render(
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root multiple items={items}>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup
                    data-testid="popup"
                    class="animation-test-popup"
                    aria-label="Fruits"
                  >
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
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
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByTestId('input');
        });
        await user.type(input, 'zz');

        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent('No matches');
        });
        expect(screen.queryByText('apple')).toBe(null);

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');

        expect(screen.getByRole('status')).toHaveTextContent('No matches');
        expect(screen.queryByText('apple')).toBe(null);

        // The first read of the animations of the popup after the close gives an empty list, and
        // `nextAnimationsRead` would resolve with it. The animation of 100 s still runs after
        // `animationstart`, so the case reads the list itself. A busy machine can stall the page
        // for some seconds, so the wait for the end has no time limit.
        const animations = popup.getAnimations();
        for (const animation of animations) {
          animation.finish();
        }
        await Promise.all(animations.map((animation) => animation.finished));
        await waitFor(() => {
          expect(popup).not.toBeInTheDocument();
        });
        expect(screen.queryByTestId('popup')).toBe(null);

        await user.click(trigger);

        const reopenedInput = await screen.findByTestId('input');
        expect(reopenedInput).toHaveValue('');
        expect(screen.getByText('apple')).not.toBe(null);
      },
    );

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

        const input = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('trigger'));
          return screen.findByTestId('input');
        });
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
      'clears the deferred popup input when reopening during close animation',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const items = ['apple', 'apricot', 'banana'];
        const { user } = await render(
          <>
            <style>{closeAnimationStyle}</style>
            <Combobox.Root multiple items={items}>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup
                    data-testid="popup"
                    class="animation-test-popup"
                    aria-label="Fruits"
                  >
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
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
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByTestId('input');
        });
        await user.type(input, 'zz');

        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent('No matches');
        });

        const popup = screen.getByTestId('popup');
        await nextEvent(popup, 'animationstart', { action: () => user.keyboard('{Escape}') });
        expect(popup).toHaveAttribute('data-ending-style');

        await user.click(trigger);

        await waitFor(() => {
          expect(popup).toHaveAttribute('data-open');
        });
        await waitFor(() => {
          expect(popup).not.toHaveAttribute('data-ending-style');
        });

        expect(screen.getByTestId('input')).toHaveValue('');
        expect(screen.getByText('apple')).not.toBe(null);
        expect(screen.getByText('banana')).not.toBe(null);
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
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByTestId('input');
        });
        await user.type(input, 'zz');

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

      const input = await waitForLaterMillisecond(async () => {
        await user.click(screen.getByText('Open'));
        return screen.findByTestId('input');
      });
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

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('');
      expect(onInput.mock.lastCall?.[0]).toBe('');
      expect(onInput.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
    });

    it('VUE-115: gives an empty array to the field for a null value', async () => {
      const validate = vi.fn<(value: unknown) => null>(() => null);
      const value = shallowRef<string[] | null>(null);
      const App = defineComponent(() => () => (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Combobox.Root
            multiple
            modelValue={value.value}
            {...{
              'onUpdate:modelValue': (next: string[]) => {
                value.value = next;
              },
            }}
          >
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
          </Combobox.Root>
        </Field.Root>
      ));

      const { user } = await render(<App />);
      const input = screen.getByTestId('input');

      input.focus();
      input.blur();

      expect(validate.mock.calls[0]?.[0]).toEqual([]);

      const option = await waitForLaterMillisecond(async () => {
        await user.click(input);
        return screen.findByRole('option', { name: 'a' });
      });
      await user.click(option);

      expect(value.value).toEqual(['a']);
      expect(input).toHaveAttribute('data-dirty', '');

      await user.click(option);

      expect(value.value).toEqual([]);
      expect(input).not.toHaveAttribute('data-dirty');
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
            modelValue={value.value}
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

      // Vue skips the listener of the item that the query mounted, in the millisecond of its mount.
      await waitForLaterMillisecond(async () => {
        await user.type(input, 'tonari');

        expect(screen.queryByRole('option', { name: 'Spirited Away' })).toBe(null);
      });
      await user.click(screen.getByRole('option', { name: 'My Neighbor Totoro' }));

      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Spirited Away' })).not.toBe(null);
      });
    });
  });

  describe('prop: filteredItems', () => {
    it('resets external filteredItems when reopening after a selection', async () => {
      interface TestItem {
        id: number;
        label: string;
        label2: string;
      }

      const testItems: TestItem[] = [
        { id: 1, label: 'apple', label2: 'one' },
        { id: 2, label: 'orange', label2: 'two' },
        { id: 3, label: 'banana', label2: 'three' },
      ];

      function getItemLabelToFilter(item: TestItem | null) {
        return item ? `${item.label} ${item.label2}` : '';
      }

      function getItemLabelToDisplay(item: TestItem | null) {
        return item ? item.label || item.label2 : '';
      }

      const FilteredItemsCombobox = defineComponent(() => {
        const searchValue = shallowRef('');
        const value = shallowRef<TestItem | null>(null);
        const { contains } = Combobox.useFilter(() => ({ value: value.value }));
        const filteredItems = computed(() =>
          testItems.filter((item) => contains(item, searchValue.value, getItemLabelToFilter)),
        );

        return () => (
          <Combobox.Root
            items={testItems}
            filteredItems={filteredItems.value}
            inputValue={searchValue.value}
            onInputValueChange={(next: string) => {
              searchValue.value = next;
            }}
            modelValue={value.value}
            onValueChange={(next: TestItem | null) => {
              value.value = next;
            }}
            itemToStringLabel={getItemLabelToDisplay}
            isItemEqualToValue={(item: TestItem | null, other: TestItem | null) =>
              item?.id === other?.id
            }
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.Empty>No items found.</Combobox.Empty>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: TestItem }) => (
                        <Combobox.Item key={item.id} value={item}>
                          <Combobox.ItemIndicator></Combobox.ItemIndicator>
                          {item.label}
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

      const { user } = await render(<FilteredItemsCombobox />);
      const input = screen.getByRole('combobox');

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await user.type(input, 'one');
        await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
      });
      expect(screen.queryByRole('option', { name: 'orange' })).toBe(null);

      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'));
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'orange' })).not.toBe(null);
      });
    });

    it('uses filteredItems when items prop is omitted', async () => {
      const fruits = ['Apple', 'Banana', 'Cherry'];

      const FilteredItemsOnlyCombobox = defineComponent(() => {
        const value = shallowRef<string | null>(null);

        return () => (
          <Combobox.Root
            filteredItems={fruits}
            modelValue={value.value}
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

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await screen.findByRole('listbox');
      });
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
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
        await moveOver(visibleOption);
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
        // In the frame after the click, Firefox can scroll the dialog again. That scroll replaces
        // the position that the case sets.
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
      // In the frame after the click, Firefox can scroll the dialog again. That scroll replaces
      // the position that the case sets.
      await waitSingleFrame();
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
      const AsyncCombobox = defineComponent({
        props: {
          items: { type: Array as PropType<string[]>, default: () => [] },
          dataProp: { type: String as PropType<'items' | 'filteredItems'>, default: 'items' },
          autoHighlight: { type: Boolean, default: true },
          open: { type: Boolean, default: undefined },
          inputValue: { type: String, default: undefined },
          onOpenChange: Function as PropType<
            (open: boolean, details: Combobox.Root.OpenChangeEventDetails) => void
          >,
          onInputValueChange: Function as PropType<(value: string) => void>,
          onValueChange: Function as PropType<(value: string | null) => void>,
          onItemHighlighted: Function as PropType<(value: string | undefined) => void>,
        },
        setup(props) {
          return () => (
            <Combobox.Root
              {...(props.dataProp === 'items'
                ? { items: props.items }
                : { filteredItems: props.items })}
              autoHighlight={props.autoHighlight}
              filter={null}
              open={props.open}
              inputValue={props.inputValue}
              onOpenChange={props.onOpenChange}
              onInputValueChange={props.onInputValueChange}
              onValueChange={props.onValueChange}
              onItemHighlighted={props.onItemHighlighted}
            >
              <Combobox.Input />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup">
                    <Combobox.Empty>No matches</Combobox.Empty>
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

      function rejectTypedOpen(nextOpen: boolean, details: Combobox.Root.OpenChangeEventDetails) {
        if (nextOpen && details.reason === REASONS.inputChange) {
          details.cancel();
        }
      }

      it.each(['items', 'filteredItems'] as const)(
        'highlights a candidate arriving after typing with %s',
        async (dataProp) => {
          const onItemHighlighted = vi.fn();
          const onValueChange = vi.fn();
          const { user, setProps } = await render(
            <AsyncCombobox
              dataProp={dataProp}
              onItemHighlighted={onItemHighlighted}
              onValueChange={onValueChange}
            />,
          );
          const input = screen.getByRole('combobox');
          await user.type(input, '32');
          onItemHighlighted.mockClear();
          await setProps({ items: ['32', '320'] });

          const option = screen.getByRole('option', { name: '32' });
          expect(option).toHaveAttribute('data-highlighted');
          expect(input).toHaveAttribute('aria-activedescendant', option.id);
          expect(onItemHighlighted).toHaveBeenCalledExactlyOnceWith(
            '32',
            expect.objectContaining({ index: 0, reason: 'none' }),
          );

          await user.keyboard('{Enter}');
          expect(onValueChange).toHaveBeenCalledExactlyOnceWith('32', expect.anything());
        },
      );

      it('waits for a controlled popup to open', async () => {
        const { user, setProps } = await render(<AsyncCombobox items={['32']} open={false} />);
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ open: true });
        expect(screen.getByRole('option')).toHaveAttribute('data-highlighted');
      });

      it('discards the request when a rejected typed open is followed by a controlled open', async () => {
        const { user, setProps } = await render(
          <AsyncCombobox items={['32']} open={false} onOpenChange={rejectTypedOpen} />,
        );
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ open: true });
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
      });

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

      it('discards the request when an ignored typed open is followed by another open', async () => {
        const onOpenChange = vi.fn();
        const { user, setProps } = await render(
          <AsyncCombobox items={['32']} open={false} onOpenChange={onOpenChange} />,
        );
        await user.type(screen.getByRole('combobox'), '32');
        await user.click(screen.getByTestId('trigger'));
        // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
        await waitFor(() => {
          expect(onOpenChange).toHaveBeenLastCalledWith(
            true,
            expect.objectContaining({ reason: REASONS.triggerPress }),
          );
        });
        await setProps({ open: true });
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
      });

      it.each(['Trigger', 'ArrowDown'] as const)(
        'discards the request when a rejected typed open is followed by opening with %s',
        async (method) => {
          const { user } = await render(
            <AsyncCombobox items={['32', '320']} onOpenChange={rejectTypedOpen} />,
          );
          const input = screen.getByRole('combobox');
          input.focus();
          await flushMicrotasks();
          await user.keyboard('32');
          expect(screen.queryByRole('listbox')).toBe(null);

          if (method === 'Trigger') {
            await user.click(screen.getByTestId('trigger'));
          } else {
            await user.keyboard('{ArrowDown}');
          }

          // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
          const option = await screen.findByRole('option', { name: '32' });
          expect(option).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant');
        },
      );

      it('discards the request when the controlled input is cleared', async () => {
        const onValueChange = vi.fn();
        const ControlledCombobox = defineComponent({
          props: {
            clear: { type: Boolean, default: false },
            items: { type: Array as PropType<string[]>, default: () => [] },
          },
          setup(props) {
            const inputValue = shallowRef('');
            return () => (
              <AsyncCombobox
                items={props.items}
                inputValue={props.clear ? '' : inputValue.value}
                onInputValueChange={(next: string) => {
                  inputValue.value = next;
                }}
                onValueChange={onValueChange}
              />
            );
          },
        });
        const { user, setProps } = await render(<ControlledCombobox />);
        const input = screen.getByRole('combobox');
        await user.type(input, '32');
        await setProps({ clear: true });
        await setProps({ clear: true, items: ['32'] });
        expect(input).toHaveValue('');
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
        await user.keyboard('{Enter}');
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it.skipIf(isJSDOM)(
        'discards the request when a controlled close is interrupted',
        async () => {
          const { user, setProps } = await render(<AsyncCombobox open />);
          const input = screen.getByRole('combobox');
          await user.type(input, '32');
          screen.getByTestId('popup').animate({ opacity: [1, 0] }, { duration: 10000 });

          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
          await setProps({ open: false, items: ['32'] });
          await setProps({ open: true, items: ['32'] });
          expect(input).toHaveValue('32');
          expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
        },
      );

      it('does not reset keyboard navigation when candidates change', async () => {
        const { user, setProps } = await render(<AsyncCombobox />);
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ items: ['32', '320'] });
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('option', { name: '320' })).toHaveAttribute('data-highlighted');
        await setProps({ items: ['321', '320'] });
        expect(screen.getByRole('option', { name: '320' })).toHaveAttribute('data-highlighted');
      });

      it('discards the request when autoHighlight is disabled', async () => {
        const { user, setProps } = await render(<AsyncCombobox />);
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ autoHighlight: false });
        await setProps({ autoHighlight: true, items: ['32'] });
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
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
        expect(screen.getByRole('listbox')).not.toBe(null);
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
        expect(screen.getByRole('listbox')).not.toBe(null);
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

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });

      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      // Vue skips the listener of the item that the query mounted, in the millisecond of its mount.
      await waitForLaterMillisecond(() => user.type(input, 'pyth'));
      await user.click(screen.getByRole('option', { name: 'Python' }));

      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);

      input.focus();
      await waitForLaterMillisecond(async () => {
        await user.keyboard('{ArrowDown}');
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });

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

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });

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
      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });

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
      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });

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
      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });
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

      await waitForLaterMillisecond(async () => {
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });
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

      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });
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

      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });
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

      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByTestId('trigger'));
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });
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
        // Vue skips the listener of an item that the open or the query mounted, in the millisecond
        // of its mount.
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          const combobox = screen.getByRole('combobox');
          await waitFor(() => expect(combobox).toHaveFocus());
          if (query) {
            await user.type(combobox, query);
          }
          await user.keyboard(query ? '{ArrowDown}' : '{ArrowDown}{ArrowDown}');
          expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
            'data-highlighted',
          );
          onItemHighlighted.mockClear();
          return combobox;
        });
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
      let input = await waitForLaterMillisecond(async () => {
        await fireEvent.click(trigger);
        return screen.findByRole('combobox');
      });
      await waitFor(() => expect(input).toHaveFocus());
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-highlighted');

      onOpenChangeComplete.mockClear();
      await fireEvent.keyDown(input, { key: 'Escape' });
      await waitFor(() => expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false));
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).toBe(null);

      await waitForLaterMillisecond(async () => {
        await fireEvent.click(trigger);
        input = await screen.findByRole('combobox');
      });
      await waitFor(() => expect(input).toHaveFocus());
      expect(input).not.toHaveAttribute('aria-activedescendant');
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('data-highlighted');
    });

    it('clears the highlight when an inline list unmounts while the input has no focus', async () => {
      await render(
        <Combobox.Root inline items={['Apple', 'Banana', 'Cherry']}>
          <Dialog.Root>
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
                <Dialog.Close>Done</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Choose fruit' });
      const done = await waitForLaterMillisecond(async () => {
        await fireEvent.click(trigger);
        return screen.findByRole('button', { name: 'Done' });
      });
      // The input gives up the focus before the highlight, so its `focusout` cannot clear the
      // highlight when the dialog closes.
      done.focus();
      await flushMicrotasks();
      await moveOver(screen.getByRole('option', { name: 'Banana' }));
      expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-highlighted');

      await fireEvent.click(done);
      expect(screen.queryByRole('dialog')).toBe(null);

      const input = await waitForLaterMillisecond(async () => {
        await fireEvent.click(trigger);
        return screen.findByRole('combobox');
      });
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
                  modelValue={value.value}
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
          expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
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
          expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
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
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          await screen.findByRole('dialog', { name: 'Fruit chooser' });
          return screen.findByTestId('dialog-input');
        });

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
        const input = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          await screen.findByRole('dialog', { name: 'Fruit chooser' });
          return screen.findByTestId('dialog-input');
        });

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

  describe('Form', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('submits stringified value to onFormSubmit when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const handleFormSubmit = vi.fn();

      const { user } = await render(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root
              items={items}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
              defaultValue={items[0]}
            >
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: (typeof items)[number] }) => (
                          <Combobox.Item key={item.code} value={item}>
                            {item.label}
                          </Combobox.Item>
                        ),
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'US' });
    });

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = createFormDataSpy('country');

      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];

      await render(
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Combobox.Root
            name="country"
            form="external-form"
            items={items}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
            defaultValue={items[0]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: (typeof items)[number] }) => (
                        <Combobox.Item key={item.code} value={item}>
                          {item.label}
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

      await fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('US');
    });

    it.skipIf(isJSDOM)(
      'submits multiple values to an external form when `form` is provided',
      async () => {
        const submitSpy = vi.fn((event: Event) => {
          event.preventDefault();
          return new FormData(event.currentTarget as HTMLFormElement).getAll('countries');
        });

        const items = [
          { code: 'US', label: 'United States' },
          { code: 'CA', label: 'Canada' },
          { code: 'AU', label: 'Australia' },
        ];

        await render(
          <>
            <form id="external-form" onSubmit={submitSpy}>
              <button type="submit">Submit</button>
            </form>
            <Combobox.Root
              multiple
              name="countries"
              form="external-form"
              items={items}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
              defaultValue={[items[0], items[2]]}
            >
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: (typeof items)[number] }) => (
                          <Combobox.Item key={item.code} value={item}>
                            {item.label}
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

        await fireEvent.click(screen.getByRole('button'));

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toEqual(['US', 'AU']);
      },
    );

    describe('serialization for object values', () => {
      const items = [
        { value: 'US', label: 'United States' },
        { value: 'CA', label: 'Canada' },
        { value: 'AU', label: 'Australia' },
      ];

      it('serializes {value,label} objects using their value field', async () => {
        await render(
          <Combobox.Root
            name="country"
            items={items}
            itemToStringLabel={(item) => item.label}
            defaultValue={items[1]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: { value: string; label: string } }) => (
                        <Combobox.Item key={item.value} value={item}>
                          {item.label}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const hiddenInput = screen.getByDisplayValue('CA');
        expect(hiddenInput.tagName).toBe('INPUT');
        expect(hiddenInput).toHaveAttribute('name', 'country');
      });

      it('serializes multiple {value,label} objects into multiple hidden inputs', async () => {
        const values = [items[0], items[2]];
        const { container } = await render(
          <Combobox.Root
            name="countries"
            items={items}
            itemToStringLabel={(item) => item.label}
            multiple
            defaultValue={values}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: { value: string; label: string } }) => (
                        <Combobox.Item key={item.value} value={item}>
                          {item.label}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const hiddenInputs = container.querySelectorAll('input[name="countries"]');
        expect(hiddenInputs).toHaveLength(values.length);
        values.forEach((item, index) => {
          expect(hiddenInputs[index]).toHaveValue(item.value);
        });
      });

      it('falls back to itemToStringValue when object lacks value', async () => {
        const codeItems = [
          { code: 'US', name: 'United States' },
          { code: 'CA', name: 'Canada' },
          { code: 'AU', name: 'Australia' },
        ];

        const { container } = await render(
          <Combobox.Root
            name="country"
            items={codeItems}
            itemToStringLabel={(item) => item.name}
            itemToStringValue={(item) => item.code}
            defaultValue={codeItems[0]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: { code: string; name: string } }) => (
                        <Combobox.Item key={item.code} value={item}>
                          {item.name}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const hiddenInput = container.querySelector('input[name="country"]');
        expect(hiddenInput).toHaveValue('US');
      });
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner />
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('focuses trigger and surfaces errors when input is inside popup', async () => {
      const handleSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="combobox">
            <Combobox.Root required>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input as={Input} data-testid="input" />
                    <Combobox.List>
                      <Combobox.Item value="a">a</Combobox.Item>
                      <Combobox.Item value="b">b</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls.length).toBe(0);

      const trigger = screen.getByTestId('trigger');

      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toHaveAttribute('data-invalid', '');

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');

      await user.click(trigger);

      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('data-invalid');
    });

    it('submits when input renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = await render(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Input as={Input} data-testid="input" />
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
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('name', 'country');

      await user.click(input);
      await user.click(screen.getByRole('option', { name: 'France' }));
      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('submits when input inside popup renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = await render(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Trigger>
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input as={Input} data-testid="input" />
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
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByRole('combobox'));
      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('name');

      await user.click(screen.getByRole('option', { name: 'France' }));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).toHaveValue('France');

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('clears external errors on change', async () => {
      const { user } = await render(
        <Form
          errors={{
            combobox: 'test',
          }}
        >
          <Field.Root name="combobox">
            <Combobox.Root>
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
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('test');

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.click(input);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      vi.advanceTimersByTime(200);
      await flushMicrotasks();
      await user.click(option);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('submits on Enter when no item is highlighted (does not prevent)', async () => {
      const handleSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['apple', 'banana']} openOnInputClick>
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
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      // No navigation, so nothing highlighted
      await user.keyboard('{Enter}');

      expect(handleSubmit.mock.calls.length).toBe(1);
    });

    it('prevents submit on Enter when an item is highlighted', async () => {
      const handleSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['alpha', 'beta']} openOnInputClick>
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
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(handleSubmit.mock.calls.length).toBe(0);
    });
  });

  describe('Field', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Combobox.Root>
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
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('disabled');

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-combobox">
          <Combobox.Root>
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
        </Field.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'field-combobox');
    });

    it('Field.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Search</Field.Label>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger" id="x-id">
              Open
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const label = screen.getByTestId<HTMLLabelElement>('label');
      const trigger = screen.getByTestId('trigger');

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      expect(trigger).toHaveAttribute('id', 'x-id');
    });

    it('does not apply validation ARIA attributes to input inside popup', async () => {
      const { user } = await render(
        <Field.Root invalid>
          <Combobox.Root>
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
          </Combobox.Root>
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" match />
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const description = screen.getByTestId('description');
      const error = screen.getByTestId('error');
      const triggerDescribedBy = trigger.getAttribute('aria-describedby');

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(triggerDescribedBy).toContain(description.id);
      expect(triggerDescribedBy).toContain(error.id);

      await user.click(trigger);

      const input = await screen.findByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).not.toHaveAttribute('aria-describedby');
      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(input).not.toHaveAttribute('data-touched');
      expect(input).not.toHaveAttribute('data-dirty');
      expect(input).not.toHaveAttribute('data-filled');
      expect(input).not.toHaveAttribute('data-focused');
    });

    it('Combobox.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger" id="x-id">
            Open
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const label = screen.getByTestId<HTMLDivElement>('label');
      const trigger = screen.getByTestId('trigger');

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      expect(trigger).toHaveAttribute('id', 'x-id');
    });

    it('Combobox.Label focuses trigger without opening when input is inside popup', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('label'));

      expect(screen.getByTestId('trigger')).toHaveFocus();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      await flushMicrotasks();

      expect(input).toHaveAttribute('data-touched', '');
      expect(trigger).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      const { user } = await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(input);
      await flushMicrotasks();
      vi.advanceTimersByTime(200);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'Option 1' });

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.click(option);
      await flushMicrotasks();

      expect(input).toHaveAttribute('data-dirty', '');
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    it('removes [data-dirty] in multiple mode after returning to the initial value', async () => {
      const { user } = await render(
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
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
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');
      const optionB = screen.getByRole('option', { name: 'b' });

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(optionB);

      await waitFor(() => {
        expect(input).toHaveAttribute('data-dirty', '');
      });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      await user.click(optionB);

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');
    });

    it('removes [data-dirty] when an equal object value is reselected (different reference)', async () => {
      const options = [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
      ];

      const { user } = await render(
        <Field.Root>
          <Combobox.Root
            multiple
            defaultOpen
            items={options}
            // The initial value is a different object reference than the rendered items, equal only
            // by the `isItemEqualToValue` comparator.
            defaultValue={[{ id: 'a', label: 'a' }]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.id}
            isItemEqualToValue={(item, value) => item.id === value.id}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {{
                      item: ({ item }: { item: (typeof options)[number] }) => (
                        <Combobox.Item key={item.id} value={item}>
                          {item.label}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(screen.getByRole('option', { name: 'a' }));

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      // Reselecting adds the item's object, a different reference than the initial value. The field
      // only returns to pristine if the dirty check compares via the provided comparator rather
      // than by reference.
      await user.click(screen.getByRole('option', { name: 'a' }));

      expect(trigger).not.toHaveAttribute('data-dirty');
    });

    it('keeps [data-dirty] when the same values are reselected in a different order', async () => {
      const { user } = await render(
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a', 'b']}>
            <Combobox.Trigger data-testid="trigger" />
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
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      // Deselect 'a' -> ['b'].
      await user.click(screen.getByRole('option', { name: 'a' }));
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      // Reselect 'a' -> ['b', 'a']. The set matches the initial value but the order differs.
      // Order is significant (it is preserved in form submission and compared element-by-element),
      // so the field stays dirty.
      await user.click(screen.getByRole('option', { name: 'a' }));
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', async () => {
        const { user } = await render(
          <Field.Root>
            <Combobox.Root>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="">Select</Combobox.Item>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        expect(input).not.toHaveAttribute('data-filled');
        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(input);
        await flushMicrotasks();
        vi.advanceTimersByTime(200);
        await flushMicrotasks();

        const option = screen.getByRole('option', { name: 'Option 1' });

        // Arrow Down to focus the Option 1
        await user.keyboard('{ArrowDown}');
        await user.click(option);
        await flushMicrotasks();

        expect(input).toHaveAttribute('data-filled', '');
        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(input);

        await flushMicrotasks();

        const listbox = screen.getByRole('listbox');

        expect(listbox).not.toHaveAttribute('data-filled');
      });

      it('adds [data-filled] attribute when already filled', async () => {
        await render(
          <Field.Root>
            <Combobox.Root defaultValue="1">
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        expect(input).toHaveAttribute('data-filled');
        expect(trigger).toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-focused');
      expect(trigger).not.toHaveAttribute('data-focused');

      await fireEvent.focusIn(input);

      expect(input).toHaveAttribute('data-focused', '');
      expect(trigger).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);

      expect(input).not.toHaveAttribute('data-focused');
      expect(trigger).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      function Comboboxes(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <Field.Root data-testid="field">
            {firstMounted && (
              <Combobox.Root disabled={firstDisabled}>
                <Combobox.Input data-testid="first" />
              </Combobox.Root>
            )}
          </Field.Root>
        );
      }

      it('is removed when the focused input becomes disabled', async () => {
        const { setProps } = await render(<Comboboxes />);

        const input = screen.getByTestId('first');
        input.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(input).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused input unmounts', async () => {
        const { setProps } = await render(<Comboboxes />);

        screen.getByTestId('first').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      function Triggers(props: { disabled?: boolean; mounted?: boolean }) {
        const { disabled = false, mounted = true } = props;
        return (
          <Field.Root data-testid="field">
            <Combobox.Root disabled={disabled}>
              {mounted && <Combobox.Trigger data-testid="trigger" />}
            </Combobox.Root>
          </Field.Root>
        );
      }

      it('is removed when the focused trigger becomes disabled', async () => {
        const { setProps } = await render(<Triggers />);

        const trigger = screen.getByTestId('trigger');
        trigger.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ disabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(trigger).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused trigger unmounts', async () => {
        const { setProps } = await render(<Triggers />);

        screen.getByTestId('trigger').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ mounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });
    });

    it('does not mark as touched when focus moves into the popup', async () => {
      const validateSpy = vi.fn(() => 'error');

      await render(
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="button" data-testid="outside">
            Outside
          </button>
        </>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.focusIn(trigger);
      await waitForLaterMillisecond(async () => {
        await fireEvent.click(trigger);
        await flushMicrotasks();
      });

      const popup = screen.getByRole('dialog');

      await fireEvent.focusOut(trigger, { relatedTarget: popup });
      await fireEvent.focusIn(popup);

      await flushMicrotasks();

      expect(validateSpy.mock.calls.length).toBe(0);
      expect(trigger).toHaveAttribute('data-focused', '');
      expect(trigger).not.toHaveAttribute('data-touched');
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('validates when the popup is blurred', async () => {
      const validateSpy = vi.fn(() => 'error');

      await render(
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="button" data-testid="outside">
            Outside
          </button>
        </>,
      );

      const trigger = screen.getByTestId('trigger');
      const outside = screen.getByTestId('outside');

      await fireEvent.focusIn(trigger);
      await waitForLaterMillisecond(async () => {
        await fireEvent.click(trigger);
        await flushMicrotasks();
      });

      const popup = screen.getByRole('dialog');

      // The four events go in one task, as in Base UI. The `focusout` of the popup marks a focus
      // change inside the popup, and the check of the first `focusout` clears that marker.
      await Promise.all([
        fireEvent.focusOut(trigger, { relatedTarget: popup }),
        fireEvent.focusIn(popup),
        fireEvent.focusOut(popup, { relatedTarget: outside }),
        fireEvent.focusIn(outside),
      ]);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });
      // The store commits the close before the Field's state updates land.
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-touched', '');
      });
      expect(trigger).not.toHaveAttribute('data-focused');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('[data-invalid]', async () => {
      await render(
        <Field.Root invalid>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).toHaveAttribute('data-invalid', '');
      expect(trigger).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      const { user } = await render(
        <Field.Root validationMode="onBlur">
          <Combobox.Root>
            <Combobox.Input data-testid="input" required />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(trigger).not.toHaveAttribute('data-valid');
      expect(trigger).not.toHaveAttribute('data-invalid');

      // Select an option to produce a valid value, then blur to commit
      await fireEvent.focusIn(input);
      await user.click(input);
      const option = await screen.findByRole('option', { name: 'Option 1' });

      await user.click(option);
      await fireEvent.focusOut(input);

      await waitFor(() => expect(input).toHaveAttribute('data-valid', ''));
      expect(trigger).toHaveAttribute('data-valid', '');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(trigger).not.toHaveAttribute('data-invalid');
    });

    it('prop: validate', async () => {
      await render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      await flushMicrotasks();

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('passes raw value to validate when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const validateSpy = vi.fn((value: unknown) => {
        expect(value).toBe(items[0]);
        return 'error';
      });

      await render(
        <Field.Root validationMode="onBlur" validate={validateSpy}>
          <Combobox.Root
            items={items}
            defaultValue={items[0]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onSubmit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root validate={(val) => (val === 'a' ? 'error' : null)}>
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Clear data-testid="clear" keepMounted />
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
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.click(input);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(input).not.toHaveAttribute('aria-invalid');

      const clear = screen.getByTestId('clear');
      await user.click(clear);

      expect(document.activeElement).toBe(input);
      await user.keyboard('{Tab}');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onChange', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Selecting an item must not validate until the input is blurred.
      expect(input).not.toHaveAttribute('aria-invalid');

      await fireEvent.focusOut(input);

      await flushMicrotasks();

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Label data-testid="label" nativeLabel={false} as="span" />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Combobox.Label does not label Combobox.Input and warns when input is the form control', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      onTestFinished(() => errorSpy.mockRestore());

      await render(
        <Combobox.Root>
          <Combobox.Label data-testid="label" />
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => {
        expect(errorSpy.mock.calls.length).toBe(1);
      });

      expect(errorSpy.mock.calls[0][0]).toContain(
        'Vase UI: <Combobox.Label> labels <Combobox.Trigger> only',
      );
      expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" aria-label="Search" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // The mount hooks have run when `render` resolves, so any fallback would be set here.
      expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
    });

    it('updates Combobox.Label linkage when root id changes', async () => {
      const { setProps } = await render(
        <Combobox.Root id="first">
          <Combobox.Label data-testid="label">Food</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await setProps({ id: 'second' });

      const trigger = screen.getByTestId('trigger');

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-labelledby', 'second-label');
      });
      expect(trigger).toHaveAttribute('id', 'second');
      expect(screen.getByTestId('label')).toHaveAttribute('id', 'second-label');
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" aria-describedby="external-description" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('prop: isItemEqualToValue', () => {
    it('matches object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Combobox.Root
          items={users}
          modelValue={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof users)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.name}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Bob');
      expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('aria-selected', 'true');
    });

    it('properly deselects object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof users)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.name}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const option = screen.getByRole('option', { name: 'Bob' });

      await fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('passes item as the first comparator argument in multiple mode', async () => {
      const users = [
        { id: 1, name: 'Alice', source: 'item' },
        { id: 2, name: 'Bob', source: 'item' },
      ];

      await render(
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob', source: 'selected' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) =>
            item.id === value.id && item.source === 'item' && value.source === 'selected'
          }
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof users)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.name}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const option = screen.getByRole('option', { name: 'Bob' });
      expect(option).toHaveAttribute('aria-selected', 'true');

      await fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('does not call comparator with null when clearing the value', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const compare = vi.fn((item: any, value: any) => {
        if (value == null) {
          throw new Error('Compared against null');
        }
        return item.id === value.id;
      });

      let root = null as { inputElement: HTMLInputElement | null } | null;

      const { user } = await render(() => (
        <Combobox.Root
          ref={(instance) => {
            root = instance as { inputElement: HTMLInputElement | null } | null;
          }}
          items={users}
          defaultValue={users[0]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={compare}
        >
          <Combobox.Trigger>
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Clear data-testid="clear" keepMounted />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: (typeof users)[number] }) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.name}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const clear = await screen.findByTestId('clear');
      await user.click(clear);

      await waitFor(() => {
        expect(root!.inputElement?.value ?? '').toBe('');
      });

      expect(compare.mock.calls.length).toBeGreaterThan(0);
      compare.mock.calls.forEach((call) => {
        expect(call[1]).not.toBe(null);
      });
    });

    it('does not call comparator with undefined when items load asynchronously after opening', async () => {
      interface Country {
        code: string;
        label: string;
      }

      const loadedItems: Country[] = [
        { code: 'ca', label: 'Canada' },
        { code: 'us', label: 'United States' },
      ];

      const compare = vi.fn((item: Country, value: Country) => {
        if (item == null || value == null) {
          throw new Error('Compared against undefined');
        }
        return item.code === value.code;
      });

      const handleInputValueChange = vi.fn();
      const handleValueChange = vi.fn();

      const { user, setProps } = await render(
        <Combobox.Root
          items={undefined}
          modelValue={loadedItems[0]}
          inputValue=""
          onInputValueChange={handleInputValueChange}
          onValueChange={handleValueChange}
          itemToStringLabel={(item: Country) => item.label}
          isItemEqualToValue={compare}
          filter={null}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: Country }) => (
                      <Combobox.Item key={item.code} value={item}>
                        {item.label}
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

      await setProps({ items: loadedItems });

      const canada = await screen.findByRole('option', { name: 'Canada' });
      await moveOver(canada);
      await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'));
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      expect(compare.mock.calls.length).toBeGreaterThan(0);
      compare.mock.calls.forEach((call) => {
        expect(call[0]).not.toBe(null);
        expect(call[0]).not.toBe(undefined);
        expect(call[1]).not.toBe(null);
        expect(call[1]).not.toBe(undefined);
      });
    });

    it('keeps showing items after selecting in controlled input-inside-popup async load flow', async () => {
      interface Country {
        code: string;
        label: string;
      }

      const loadedItems: Country[] = [
        { code: 'ca', label: 'Canada' },
        { code: 'us', label: 'United States' },
      ];

      const AsyncControlledCombobox = defineComponent({
        props: {
          countries: { type: Array as PropType<Country[] | undefined>, default: undefined },
        },
        setup(props) {
          const country = shallowRef<Country | null>(null);
          const inputValue = shallowRef('');

          return () => (
            <Combobox.Root
              items={props.countries}
              filter={null}
              modelValue={country.value}
              inputValue={inputValue.value}
              onInputValueChange={(value: string) => {
                inputValue.value = value;
              }}
              isItemEqualToValue={(item, selected) => item?.code === selected?.code}
              onValueChange={(value: Country | null) => {
                if (country.value?.code === value?.code) {
                  country.value = null;
                } else {
                  country.value = value;
                }
              }}
            >
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input />
                    <Combobox.Empty data-testid="empty">No countries found.</Combobox.Empty>
                    <Combobox.List>
                      {{
                        item: ({ item }: { item: Country }) => (
                          <Combobox.Item key={item.code} value={item}>
                            {item.label}
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

      const { user, setProps } = await render(<AsyncControlledCombobox countries={undefined} />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await setProps({ countries: loadedItems });

      const canada = await screen.findByRole('option', { name: 'Canada' });
      await moveOver(canada);
      await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'));

      await user.click(canada);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(trigger);

      await screen.findByRole('option', { name: 'Canada' });
      expect(screen.getByRole('option', { name: 'United States' })).toBeInTheDocument();
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
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

      const banana = screen.getByRole('option', { name: 'banana' });
      await moveOver(banana);

      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
      expect(input.getAttribute('aria-activedescendant')).toBe(banana.id);
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} highlightItemOnHover={false}>
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

      const banana = screen.getByRole('option', { name: 'banana' });
      await moveOver(banana);
      await flushMicrotasks();

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(banana).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('prop: loopFocus', () => {
    it('loops focus from last to first item with ArrowDown by default', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
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
      input.focus();
      await flushMicrotasks();

      // ArrowUp opens and focuses last item
      await user.keyboard('{ArrowUp}');

      await screen.findByRole('listbox');

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });

      // Loop cycles through input
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(input).not.toHaveAttribute('aria-activedescendant');

      // Then to first item
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });
    });

    it('loops focus from first to last item with ArrowUp by default', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
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
      input.focus();
      await flushMicrotasks();

      // ArrowDown opens and focuses first item
      await user.keyboard('{ArrowDown}');

      await screen.findByRole('listbox');

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });

      // Loop cycles through input
      await user.keyboard('{ArrowUp}');
      await flushMicrotasks();

      expect(input).not.toHaveAttribute('aria-activedescendant');

      // Then to last item
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });
    });

    it('does not loop focus from last to first with ArrowDown when loopFocus={false}', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} loopFocus={false}>
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
      input.focus();
      await flushMicrotasks();

      // ArrowUp opens and focuses last item
      await user.keyboard('{ArrowUp}');

      await screen.findByRole('listbox');

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });

      // Should stay at last item (no loop)
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
    });

    it('does not loop focus from first to last with ArrowUp when loopFocus={false}', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} loopFocus={false}>
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
      input.focus();
      await flushMicrotasks();

      // ArrowDown opens and focuses first item
      await user.keyboard('{ArrowDown}');

      await screen.findByRole('listbox');

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });

      // Should stay at first item (no loop)
      await user.keyboard('{ArrowUp}');
      await flushMicrotasks();

      expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    });
  });

  describe('coverage edge cases', () => {
    it('allows an attempted open to be canceled', async () => {
      const onOpenChange = vi.fn((_open, details: Combobox.Root.OpenChangeEventDetails) => {
        details.cancel();
      });
      const { user } = await render(
        <Combobox.Root onOpenChange={onOpenChange}>
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

      await user.click(screen.getByRole('combobox'));

      expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('handles closing after a changed query is cleared', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen items={['apple']}>
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
      await user.type(input, 'a');
      await user.clear(input);
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('clears a multiple inline query on close', async () => {
      const { user } = await render(
        <Combobox.Root multiple inline open items={['apple']}>
          <Combobox.Input data-testid="inline-input" />
          <Combobox.Trigger>Toggle</Combobox.Trigger>
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

      const input = screen.getByTestId('inline-input');
      await user.type(input, 'a');
      await fireEvent.click(screen.getByText('Toggle'));

      expect(input).toHaveValue('');
    });

    it('normalizes a controlled null value when selecting in multiple mode', async () => {
      const onValueChange = vi.fn();
      await render(
        <Combobox.Root
          multiple
          modelValue={null as never}
          defaultOpen
          onValueChange={onValueChange}
        >
          <Combobox.Input />
          <Combobox.List>
            <Combobox.Item value="apple">apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Root>,
      );

      await fireEvent.click(screen.getByRole('option', { name: 'apple' }));

      expect(onValueChange).toHaveBeenCalledWith(['apple'], expect.anything());
    });

    it('normalizes a controlled null value while closed in multiple mode', async () => {
      await render(
        <Combobox.Root multiple modelValue={null as never} items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
        </Combobox.Root>,
      );

      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
    });

    it('does not seed an initial highlight for an unmatched inline value', async () => {
      await render(
        <Combobox.Root inline open defaultValue="missing" items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
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

      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
    });

    it('seeds the initial highlight for a matched inline value', async () => {
      await render(
        <Combobox.Root inline open defaultValue="apple" items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
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

      expect(screen.getByTestId('selected-index')).toHaveTextContent('0');
    });

    it('restores the first highlight after an always-highlighted query becomes empty', async () => {
      const { user } = await render(
        <Autocomplete.Root defaultOpen autoHighlight="always" items={['apple']}>
          <Autocomplete.Input />
          <Autocomplete.List>
            {{
              item: ({ item }: { item: string }) => (
                <Autocomplete.Item key={item} value={item}>
                  {item}
                </Autocomplete.Item>
              ),
            }}
          </Autocomplete.List>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'z');
      expect(screen.queryByRole('option')).toBe(null);

      await user.clear(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute('data-highlighted');
      });
    });

    it('omits groups with no matching items', async () => {
      const items = [
        { value: 'fruit', items: ['apple'] },
        { value: 'vegetables', items: ['broccoli'] },
      ];
      const { user } = await render(
        <Combobox.Root defaultOpen items={items}>
          <Combobox.Input />
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
        </Combobox.Root>,
      );

      await user.type(screen.getByRole('combobox'), 'app');

      expect(screen.getByText('fruit')).not.toBe(null);
      expect(screen.queryByText('vegetables')).toBe(null);
    });

    it('exposes an unmount action that is ignored while open', async () => {
      let actions = null as Combobox.Root.Actions | null;
      const onOpenChangeComplete = vi.fn();
      await render(() => (
        <Combobox.Root
          defaultOpen
          ref={(instance) => {
            actions = instance as Combobox.Root.Actions | null;
          }}
          onOpenChangeComplete={onOpenChangeComplete}
        >
          <Combobox.Input />
        </Combobox.Root>
      ));

      actions!.unmount();
      await flushMicrotasks();

      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    });

    it('moves focus from the hidden control to an external input', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Input data-testid="visible-input" />
        </Combobox.Root>,
      );
      const visibleInput = screen.getByTestId('visible-input');
      const hiddenInput = getHiddenInput();

      await fireEvent.focusIn(hiddenInput);

      expect(visibleInput).toHaveFocus();
    });

    it('falls back to the trigger when the hidden control is focused', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        </Combobox.Root>,
      );
      const hiddenInput = getHiddenInput();

      await fireEvent.focusIn(hiddenInput);

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('falls back to the trigger after an external input unmounts', async () => {
      function Test(props: { showInput: boolean }) {
        return (
          <Combobox.Root>
            {props.showInput ? (
              <Combobox.Input />
            ) : (
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            )}
          </Combobox.Root>
        );
      }

      const { rerender } = await render(<Test showInput />);
      await rerender(<Test showInput={false} />);

      await fireEvent.focusIn(getHiddenInput());

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('moves hidden-control focus to the trigger when the input is inside the popup', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await fireEvent.focusIn(getHiddenInput());

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('safely handles hidden-control focus without a visible control', async () => {
      await render(<Combobox.Root />);
      const hiddenInput = getHiddenInput();

      await fireEvent.focusIn(hiddenInput);

      expect(document.body).toHaveFocus();
    });

    it('ignores scalar browser autofill in multiple mode', async () => {
      const onValueChange = vi.fn();
      await render(
        <Combobox.Root multiple items={['apple']} onValueChange={onValueChange}>
          <Combobox.Input data-testid="visible-input" />
        </Combobox.Root>,
      );
      const hiddenInput = getHiddenInput();

      await fireEvent.input(hiddenInput, { target: { value: 'apple' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('ignores unmatched browser autofill in single mode', async () => {
      const onValueChange = vi.fn();
      await render(
        <Combobox.Root name="fruit" items={['apple']} onValueChange={onValueChange}>
          <Combobox.Input />
        </Combobox.Root>,
      );
      const hiddenInput = screen
        .getAllByDisplayValue('')
        .find((element) => element.getAttribute('name') === 'fruit')!;

      await fireEvent.input(hiddenInput, { target: { value: 'orange' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not request form submission when no form owns the autocomplete', async () => {
      await render(
        <Autocomplete.Root defaultOpen submitOnItemClick>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      await fireEvent.click(screen.getByRole('option', { name: 'apple' }));
      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('does not request form submission when requestSubmit is unavailable', async () => {
      await render(
        <form aria-label="search">
          <Autocomplete.Root defaultOpen submitOnItemClick>
            <Autocomplete.Input />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'search' });
      Object.defineProperty(form, 'requestSubmit', { configurable: true, value: undefined });

      await fireEvent.click(screen.getByRole('option', { name: 'apple' }));
      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('validates the autocomplete input when focus leaves its popup', async () => {
      const validate = vi.fn();
      const { user } = await render(
        <Field.Root validationMode="onBlur" validate={validate}>
          <Autocomplete.Root defaultOpen defaultValue="query">
            <Autocomplete.Trigger>Open</Autocomplete.Trigger>
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.Input />
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      await user.click(document.body);

      await waitFor(() => {
        expect(validate).toHaveBeenCalledWith('query', expect.anything());
      });
    });
  });

  describe('within Composite', () => {
    it('should navigate between combobox and composite items', async () => {
      const { user } = await render(
        <CompositeRoot orientation="horizontal">
          <CompositeItem as="button">Item 1</CompositeItem>
          <CompositeItem as="button">Item 2</CompositeItem>
          <Combobox.Root>
            <Combobox.Input
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => (
                  <CompositeItem as="input" {...props} />
                ),
              }}
            />
          </Combobox.Root>
        </CompositeRoot>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('{ArrowLeft}');
      const button2 = screen.getByRole('button', { name: 'Item 2' });
      expect(button2).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();
    });
  });

  describe('VUE-112: a disabled fieldset', () => {
    it('shows the disabled state on the input and the trigger in a disabled fieldset', async () => {
      await render(() => (
        <fieldset disabled>
          <Combobox.Root items={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
          </Combobox.Root>
        </fieldset>
      ));

      expect(screen.getByTestId('input')).toHaveAttribute('data-disabled');
      expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled');
    });

    it('shows the disabled state on the input of an autocomplete in a disabled fieldset', async () => {
      await render(() => (
        <fieldset disabled>
          <Autocomplete.Root items={['a', 'b']}>
            <Autocomplete.Input data-testid="input" />
          </Autocomplete.Root>
        </fieldset>
      ));

      expect(screen.getByTestId('input')).toHaveAttribute('data-disabled');
    });
  });
});
