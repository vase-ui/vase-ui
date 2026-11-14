import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, computed, defineComponent, reactive, shallowRef, toRaw, watch } from 'vue';
import type { ComputedRef, PropType } from 'vue';
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
  renderOnServer,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { HTMLProps } from '../../internals/types';
import { REASONS } from '../../internals/reasons';
import * as Autocomplete from '../../autocomplete/index.parts';
import * as Combobox from '../index.parts';
import type { ComboboxStore } from '../store';
import { useComboboxInputValueContext, useComboboxRootContext } from './ComboboxRootContext';
import type { ComboboxInputElementValue } from './ComboboxRootContext';
import ComboboxRootHydration from './ComboboxRootHydration.test.vue';

// Most cases use the fixture parts in place of the positioner, the list and the items, and they
// test the root. Most cases also use the fixture input. It handles only the `input` event, and its
// `insidePopup` prop stands for a positioner around it. The Base UI cases of this file render the
// parts of the family. A ported case replaces the case of this file that tests the same thing: the
// order of the events, a canceled change, the controlled values, the hidden inputs, the autofill,
// the field and the server render. One Base UI case of this file renders only the root. It is in
// the block `coverage edge cases`.

const HYDRATION_FILE = 'src/combobox/root/ComboboxRootHydration.test.vue';
const cities = ['Malmö', 'Malta', 'Oslo'];

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
    it('gives the label of a new controlled value to the input, one time', async () => {
      const value = shallowRef('Oslo');
      const handleInputValueChange = vi.fn();
      await render(() => (
        <Combobox.Root
          items={cities}
          value={value.value}
          onInputValueChange={handleInputValueChange}
        >
          <ComboboxInputPart />
        </Combobox.Root>
      ));
      expect(getInput().value).toBe('Oslo');

      value.value = 'Malta';
      await flushMicrotasks();

      expect(getInput().value).toBe('Malta');
      expect(handleInputValueChange).toHaveBeenCalledTimes(1);
      expect(handleInputValueChange.mock.lastCall?.[0]).toBe('Malta');
      expect(handleInputValueChange.mock.lastCall?.[1].reason).toBe('none');
    });

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
    hiddenInputTypeTests({
      render,
      createComponent: (props) => (
        <Combobox.Root {...props}>
          <ComboboxInputPart />
        </Combobox.Root>
      ),
    });

    hiddenInputSizeTests({
      render,
      createComponent: (props) => (
        <Combobox.Root {...props}>
          <ComboboxInputPart />
        </Combobox.Root>
      ),
    });

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
        await user.click(input);
        expect(screen.getByRole('listbox')).not.toBe(null);

        onOpenChange.mockClear();
        await user.click(screen.getByRole('option', { name: 'apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        await user.keyboard('{ArrowDown}');
        onOpenChange.mockClear();
        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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
        await user.click(trigger);

        expect(await screen.findByRole('listbox')).not.toBe(null);
        expect(input).toHaveAttribute('aria-expanded', 'true');

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        expect(input).toHaveAttribute('aria-expanded', 'false');
      });

      it('syncs selected index when items change after close', async () => {
        const { user } = await render(<AsyncItemsCombobox />);

        const input = screen.getByTestId('input');
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        await user.click(screen.getByRole('option', { name: 'Cherry' }));
        await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

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

        await user.click(trigger);

        const appleOption = await screen.findByText('apple');
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

        await user.click(trigger);
        const appleOption = await screen.findByText('apple');
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
                value={value.value}
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

          await waitFor(() => {
            expect(input).not.toHaveAttribute('aria-activedescendant');
          });
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
                  value={value.value}
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

          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
          });

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

            return () => (
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
                        data-render={renders.value}
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
          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'sel' })).toBe(null);
          });

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

          await waitFor(() => {
            expect(apple).toHaveAttribute('data-highlighted');
          });

          await user.unhover(apple);
          await waitFor(() => {
            expect(apple).not.toHaveAttribute('data-highlighted');
          });

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

          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');

          // Move the highlight away from the selected item by filtering.
          await user.type(input, 'cherry');
          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
          });

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
          <Combobox.Root items={['apple', 'banana', 'cherry']} value="banana" defaultOpen>
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
        await waitFor(() => expect(screen.queryByRole('option', { name: 'banana' })).toBe(null));

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

          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');
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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

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
          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');

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
                value={value.value}
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
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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
                value={value.value}
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
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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
                value={value.value}
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
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
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
                value={{ id: 2, label: 'banana' }}
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
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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
              value={value.value}
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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'cherry');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });
        const bananaItem = screen.getByRole('option', { name: 'banana' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
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

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'cherry');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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

          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');
          await user.type(input, 'item 0');
          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'item 80' })).toBe(null);
          });

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
        await waitFor(() => expect(screen.queryByRole('option', { name: 'apple' })).toBe(null));

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
              value={value.value}
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
              value={value.value}
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
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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
              value={value.value}
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
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

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
          <Combobox.Root multiple value={items} name="languages">
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

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

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

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

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

      await user.click(input);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
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

      await user.click(input);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
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
    // The lock sets `overflow: hidden` on the page, or the marker of the lock on `<html>`.
    function isScrollLocked(doc: Document) {
      return (
        doc.documentElement.style.overflow === 'hidden' ||
        doc.documentElement.hasAttribute('data-vase-ui-scroll-locked') ||
        doc.body.style.overflow === 'hidden'
      );
    }

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

        await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        await fireEvent.mouseDown(trigger);

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

        await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        await fireEvent.mouseDown(trigger);

        await screen.findByRole('listbox');

        await waitSingleFrame();

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

  describe('coverage edge cases', () => {
    it('safely handles hidden-control focus without a visible control', async () => {
      await render(<Combobox.Root />);
      const hiddenInput = getHiddenInput();

      await fireEvent.focusIn(hiddenInput);

      expect(document.body).toHaveFocus();
    });
  });
});
