import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { shallowRef, watchEffect } from 'vue';
import { EMPTY_OBJECT, NOOP } from '../common/empty';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { defaultItemEquality } from '../internals/itemEquality';
import { createLabelIdRegistry } from '../internals/labelable-provider';
import { REASONS } from '../internals/reasons';
import { createInitialPopupStoreState, createPopupStoreContext } from '../utils/popups/store';
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
    popupElementId: undefined,
    triggerElement: null,
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
    ...createLabelIdRegistry(),
  };
  return new ComboboxStore(state, context, selectors);
}

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
  ] satisfies Array<{
    name: string;
    state: Partial<State>;
    read: (store: ComboboxStore) => boolean[];
    expected: boolean[];
  }>)('selects $name', ({ state, read, expected }) => {
    expect(read(createComboboxStore(state))).toEqual(expected);
  });
});
