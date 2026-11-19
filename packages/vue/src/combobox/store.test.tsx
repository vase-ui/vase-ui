import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed, defineComponent, shallowRef, watch, watchEffect } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { actOnElement } from '../../test/fixtures/actOnElement';
import { EMPTY_OBJECT, NOOP } from '../common/empty';
import { createChangeEventDetails } from '../internals/createVaseUIEventDetails';
import { defaultItemEquality } from '../internals/itemEquality';
import { createLabelIdRegistry } from '../internals/labelable-provider';
import { REASONS } from '../internals/reasons';
import {
  createInitialPopupStoreState,
  createPopupStoreContext,
} from '../utils/popups/usePopupRoot';
import ComboboxStoreHydration from './ComboboxStoreHydration.test.vue';
import { useComboboxRootContext } from './root/ComboboxRootContext';
import { ComboboxStore, selectors } from './store';
import type { ComboboxStoreContext, State } from './store';

// A store with the first state of a combobox that selects one value, and a context whose commands
// do nothing.
function createComboboxStore(initialState: Partial<State> = {}) {
  const state: State = {
    ...createInitialPopupStoreState(),
    id: undefined,
    labelId: undefined,
    selectedValue: null,
    items: undefined,
    selectionMode: 'single',
    name: undefined,
    form: undefined,
    disabled: false,
    readOnly: false,
    required: false,
    grid: false,
    virtualized: false,
    openOnInputClick: true,
    itemToStringLabel: undefined,
    isItemEqualToValue: defaultItemEquality,
    modal: false,
    autoHighlight: false,
    submitOnItemClick: false,
    hasInputValue: false,
    forceMounted: false,
    inline: false,
    activeIndex: null,
    selectedIndex: null,
    listProps: {},
    inputProps: {},
    itemRoot: {
      props: EMPTY_OBJECT,
      id: undefined,
      selectionMode: 'single',
      disabled: false,
      readOnly: false,
      isItemEqualToValue: defaultItemEquality,
    },
    listElement: null,
    listElementId: undefined,
    popupElementId: undefined,
    triggerElement: null,
    highlightedItem: null,
    highlightedItemId: undefined,
    inputElement: null,
    inputGroupElement: null,
    popupSide: null,
    openMethod: null,
    inputInsidePopup: true,
    inputOwnsFormValue: false,
    instantType: undefined,
    adaptiveOrigin: undefined,
    ...initialState,
  };
  const context: ComboboxStoreContext = {
    ...createPopupStoreContext(),
    handleUnmount: NOOP,
    setInputValue: NOOP,
    setSelectedValue: NOOP,
    setIndices: NOOP,
    handleSelection: NOOP,
    forceMount: NOOP,
    requestSubmit: NOOP,
    listRef: shallowRef([]),
    labelsRef: shallowRef([]),
    valuesRef: shallowRef([]),
    emptyRef: shallowRef(null),
    inputRef: shallowRef(null),
    startDismissRef: shallowRef(null),
    endDismissRef: shallowRef(null),
    chipsContainerRef: shallowRef(null),
    clearRef: shallowRef(null),
    pointerDownItemRef: shallowRef(null),
    selectionEventRef: shallowRef(null),
    openPressRef: shallowRef(null),
    ...createLabelIdRegistry(),
  };
  return new ComboboxStore(state, context, selectors);
}

describe('combobox store synchronization', () => {
  const { render } = createRenderer();

  // Every rendered control that has the form name. The controls that can have it are the visible
  // `combobox` input, the visually hidden `textbox`, and the `type="hidden"` inputs of the
  // `multiple` mode, which have no role.
  function namedControls(name: string) {
    return Array.from(document.querySelectorAll(`[name="${name}"]`));
  }

  let store!: ComboboxStore;
  const StoreProbe = defineComponent(() => {
    store = useComboboxRootContext();
    return () => null;
  });

  const observed: string[] = [];
  const OwnershipProbe = defineComponent(() => {
    const rootStore = useComboboxRootContext();
    const inline = computed(() => rootStore.select('inline'));
    const inputOwnsFormValue = computed(() => rootStore.select('inputOwnsFormValue'));
    return () => {
      observed.push(`${inline.value}:${inputOwnsFormValue.value}`);
      return null;
    };
  });

  // `selectionMode` is always `'none'` for `Autocomplete.Root`, and an input in the positioner
  // makes `inputInsidePopup` true. In that configuration the formula of the root for
  // `inputOwnsFormValue` differs from the formula that `ComboboxInput` writes from its `ref`
  // callback, so only here the synchronization is visible.
  const InlineOwnershipFixture = defineComponent({
    props: {
      inline: { type: Boolean, required: true },
      withPopupInput: { type: Boolean, default: true },
      withOwnershipProbe: { type: Boolean, default: false },
    },
    setup(props) {
      return () => (
        <Autocomplete.Root items={['alpha', 'beta']} inline={props.inline} name="search">
          <StoreProbe />
          {props.withOwnershipProbe && <OwnershipProbe />}
          <Autocomplete.Trigger data-testid="trigger" />
          <Autocomplete.Portal keepMounted>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                {props.withPopupInput && <Autocomplete.Input data-testid="popup-input" />}
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      );
    },
  });

  it('publishes an inline transition in a single store transaction', async () => {
    // `keepMounted` is required: a closed `Combobox.Portal` renders nothing, so without it the
    // popup input never mounts, its `ref` callback never runs, and the case would pass for no
    // reason.
    const { setProps } = await render(<InlineOwnershipFixture inline={false} />);

    // A watcher with the default flush does not run between two writes of one function.
    const snapshots: { inline: boolean; inputOwnsFormValue: boolean }[] = [];
    const stop = watch(
      () => ({ inline: store.state.inline, inputOwnsFormValue: store.state.inputOwnsFormValue }),
      (snapshot) => {
        snapshots.push(snapshot);
      },
    );

    try {
      await setProps({ inline: true });
    } finally {
      stop();
    }

    // Catches a forward split (inline published before ownership).
    expect(snapshots.some((snapshot) => snapshot.inline && !snapshot.inputOwnsFormValue)).toBe(
      false,
    );

    // Catches a reverse-order split (ownership published before inline), which the assertion
    // above cannot see. Both assertions are load-bearing; neither subsumes the other.
    //
    // The projections are deduplicated on purpose: a notification that changes neither value
    // does not count.
    const changed = snapshots.filter(
      (snapshot, index) =>
        index === 0 ||
        snapshot.inline !== snapshots[index - 1].inline ||
        snapshot.inputOwnsFormValue !== snapshots[index - 1].inputOwnsFormValue,
    );

    expect(changed).toHaveLength(1);
  });

  it('settles inputOwnsFormValue through the useStore path when inline is set', async () => {
    observed.length = 0;

    const { setProps } = await render(<InlineOwnershipFixture inline={false} withOwnershipProbe />);

    observed.length = 0;
    await setProps({ inline: true });

    // This does NOT detect a split transaction: a `computed` reads only the settled state either
    // way. The case above guards the shape of the transaction. This case pins that the
    // subscription path ends with the value that the root computes, and not with the value that
    // `ComboboxInput` wrote from its `ref` callback.
    expect(observed[observed.length - 1]).toBe('true:true');
  });

  it('exposes real commands to a descendant ref callback on the first commit', async () => {
    // A user interaction happens after the mount and cannot reach the earliest moment that a part
    // can call a command, so the probe fires from a `ref` callback. The ArrowDown handler of
    // `Combobox.Trigger` reads the `setOpen` command off the store at call time, so this case
    // exercises that earliest moment, without naming where the store keeps the command.
    const handleOpenChange = vi.fn();
    let dispatched = false;

    await render(
      <Autocomplete.Root items={['alpha', 'beta']} onOpenChange={handleOpenChange}>
        <Autocomplete.Trigger
          data-testid="trigger"
          v-slots={actOnElement('button', (element) => {
            dispatched = true;
            element.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
            );
          })}
        />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.Input />
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    expect(dispatched).toBe(true);
    expect(handleOpenChange).toHaveBeenCalled();
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
  });

  it('gives form value ownership to the hidden input when the input is inside the popup', async () => {
    const { setProps } = await render(<InlineOwnershipFixture inline={false} />);

    expect(store.state.inputInsidePopup).toBe(true);
    expect(store.state.inputOwnsFormValue).toBe(false);
    // Ownership is a two-sided invariant: asserting only that the popup input lacks the name
    // would still pass if the name were dropped from both controls and the form submitted
    // nothing at all.
    expect(screen.getByTestId('popup-input')).not.toHaveAttribute('name');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toHaveAttribute('aria-hidden', 'true');

    // Unmounting and mounting the popup input again runs its `ref` callback again, which is the
    // other writer of `inputOwnsFormValue`.
    await setProps({ withPopupInput: false });
    expect(namedControls('search')).toHaveLength(1);

    await setProps({ withPopupInput: true });
    expect(store.state.inputOwnsFormValue).toBe(false);
    expect(screen.getByTestId('popup-input')).not.toHaveAttribute('name');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps form value ownership across hydration', async () => {
    // The input is not inside a popup here, so it owns the form value itself. The server render
    // suite of `ComboboxRoot.test.tsx` already covers the ARIA attributes, so this case asserts
    // the ownership that survives into hydration.
    const serverHtml = await renderOnServer('src/combobox/ComboboxStoreHydration.test.vue');
    const template = document.createElement('template');
    template.innerHTML = serverHtml;
    const serverInput = template.content.querySelector('[data-testid="input"]');

    expect(serverInput?.getAttribute('role')).toBe('combobox');
    expect(template.content.querySelectorAll('[name="search"]')).toHaveLength(1);
    expect(template.content.querySelector('[name="search"]')).toBe(serverInput);

    await hydrate(ComboboxStoreHydration, { serverHtml });

    expect(screen.getByTestId('input')).toHaveAttribute('role', 'combobox');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toBe(screen.getByTestId('input'));
  });

  describe('interaction anchor', () => {
    it('follows the input, and returns to it after a trigger press or a change of open state', async () => {
      let store!: ComboboxStore;

      const Probe = defineComponent(() => {
        store = useComboboxRootContext();
        return () => null;
      });

      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']}>
          <Probe />
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

      expect(store.select('anchorElement')).toBe(input);

      // A trigger press opens the popup, and the anchor stays on the input.
      await fireEvent.mouseDown(trigger);
      await screen.findByRole('listbox');
      await waitFor(() => {
        expect(store.select('anchorElement')).toBe(input);
      });

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(store.select('anchorElement')).toBe(input);

      // Positioning clears the anchor while a closed popup stays mounted; reopening restores it.
      store.clearPositioning();
      await flushMicrotasks();
      expect(store.select('anchorElement')).toBe(null);
      await user.click(input);
      await screen.findByRole('listbox');
      expect(store.select('anchorElement')).toBe(input);
    });
  });
});

describe('the store with no root', () => {
  it('anchors to the input, and to the trigger when the input is in the popup', () => {
    const store = createComboboxStore({ inputInsidePopup: false });
    const input = document.createElement('input');
    const trigger = document.createElement('button');

    store.update({ inputElement: input, triggerElement: trigger });
    expect(store.state.anchorElement).toBe(input);

    store.set('inputInsidePopup', true);
    expect(store.state.anchorElement).toBe(trigger);
  });

  it('ignores a request for the open state that it has', () => {
    const store = createComboboxStore();
    const handleOpenChange = vi.fn();
    store.context.onOpenChange = handleOpenChange;

    store.setOpen(true, createChangeEventDetails(REASONS.inputChange));
    store.setOpen(true, createChangeEventDetails(REASONS.inputChange));

    expect(handleOpenChange).toHaveBeenCalledOnce();
    expect(store.select('open')).toBe(true);
  });

  // `setOpen` is a write method of the store, and a write method adds no dependency to the effect
  // that calls it. A tracked read of the open state would run the effect again at each open change.
  it('adds no dependency to an effect that requests an open state', () => {
    const store = createComboboxStore();
    let runs = 0;
    const stop = watchEffect(
      () => {
        runs += 1;
        store.setOpen(true, createChangeEventDetails(REASONS.inputChange));
      },
      { flush: 'sync' },
    );
    onTestFinished(stop);
    expect(runs).toBe(1);

    store.setOpen(false, createChangeEventDetails(REASONS.escapeKey));

    expect(runs).toBe(1);
    expect(store.select('open')).toBe(false);
  });

  it('shows an inline list as open to the interactions, and keeps the positioner element for them', () => {
    const store = createComboboxStore({ inline: true });
    expect(store.select('open')).toBe(false);
    expect(store.interactions.select('open')).toBe(true);

    // The shared selector gives no positioner while the popup is open and not mounted.
    const positioner = document.createElement('div');
    store.update({ open: true, positionerElement: positioner });
    expect(store.select('positionerElement')).toBe(null);
    expect(store.interactions.select('positionerElement')).toBe(positioner);
  });

  it('runs handleUnmount when the popup unmounts', () => {
    const store = createComboboxStore();
    const handleUnmount = vi.fn();
    store.context.handleUnmount = handleUnmount;

    store.resetOnUnmount();

    expect(handleUnmount).toHaveBeenCalledOnce();
  });

  const byId = (itemValue: { id: number }, selectedValue: { id: number }) =>
    itemValue.id === selectedValue.id;

  it.each([
    {
      name: 'isSelected with a single value',
      state: { selectedValue: 'a' },
      read: (store: ComboboxStore) => [
        store.select('isSelected', 'a'),
        store.select('isSelected', 'b'),
      ],
      expected: [true, false],
    },
    {
      name: 'isSelected with a list',
      state: { selectionMode: 'multiple', selectedValue: ['a', 'b'] },
      read: (store: ComboboxStore) => [
        store.select('isSelected', 'b'),
        store.select('isSelected', 'c'),
      ],
      expected: [true, false],
    },
    {
      name: 'isSelected with a custom comparer',
      state: { selectedValue: { id: 1 }, isItemEqualToValue: byId },
      read: (store: ComboboxStore) => [
        store.select('isSelected', { id: 1 }),
        store.select('isSelected', { id: 2 }),
      ],
      expected: [true, false],
    },
    {
      name: 'hasSelectedValue with null',
      state: { selectedValue: null },
      read: (store: ComboboxStore) => [store.select('hasSelectedValue')],
      expected: [false],
    },
    {
      name: 'hasSelectedValue with an empty list',
      state: { selectionMode: 'multiple', selectedValue: [] },
      read: (store: ComboboxStore) => [store.select('hasSelectedValue')],
      expected: [false],
    },
    {
      name: 'hasSelectedValue with a value',
      state: { selectedValue: 'a' },
      read: (store: ComboboxStore) => [store.select('hasSelectedValue')],
      expected: [true],
    },
    {
      name: 'hasSelectionChips with an empty list',
      state: { selectionMode: 'multiple', selectedValue: [] },
      read: (store: ComboboxStore) => [store.select('hasSelectionChips')],
      expected: [false],
    },
    {
      name: 'hasSelectionChips with a value',
      state: { selectionMode: 'multiple', selectedValue: ['a'] },
      read: (store: ComboboxStore) => [store.select('hasSelectionChips')],
      expected: [true],
    },
  ] satisfies {
    name: string;
    state: Partial<State>;
    read: (store: ComboboxStore) => boolean[];
    expected: boolean[];
  }[])('selects $name', ({ state, read, expected }) => {
    expect(read(createComboboxStore(state))).toEqual(expected);
  });
});
