import {
  computed,
  inject,
  nextTick,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  useId,
  watch,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { createError } from '../common/createError';
import { EMPTY_ARRAY } from '../common/empty';
import { inDocumentOrder } from '../common/element';
import { useIsHydrated } from '../common/hydration';
import { useModel } from '../common/model';
import { ownerDocument, ownerWindow } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { fieldKey } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import { getFilter } from '../common/filter';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  isSelectedValueDirty,
  removeItem,
  selectedValueIncludes,
} from '../common/itemEquality';
import { flattenLeafItems, stringifyAsLabel, type Group } from '../common/resolveValueLabel';
import { useList, type List, type ListItem } from '../list/list';
import { listNameFromControl } from '../list/name';
import { useLocale } from '../locale-provider/part';
import { usePopupFocus, type FocusTarget } from '../popup/focus';
import { isInPopup, useLayer, type Layer } from '../popup/layer';
import { useFullWidth, type Side, type usePlacement } from '../popup/placement';
import { usePopupPress } from '../popup/press';
import { usePopupRoot, type PopupRoot } from '../popup/root';
import { useScrollLock } from '../popup/useScrollLock';
import { dispatchClickWithModifiers } from '../common/dispatchClickWithModifiers';
import { filterItems, sameItems, type FilterItemToString, type ItemFilter } from './filter';
import { useComboboxForm } from './form';
import { isItemCollection } from './items';
import type {
  ComboboxRootChangeEventDetails,
  ComboboxRootChangeEventReason,
  ComboboxRootHighlightEventDetails,
  ComboboxRootOpenChangeEventDetails,
} from './types';

/** `single` and `multiple` select values. `none` is Autocomplete: the text is the value. */
export type SelectionMode = 'single' | 'multiple' | 'none';
/** The `mode` of Autocomplete. */
export type CompletionMode = 'list' | 'both' | 'inline' | 'none';

/** The props of a root, as getters. */
export interface RootSource {
  readonly family: 'Combobox' | 'Autocomplete';
  readonly mode: SelectionMode;
  readonly completion: CompletionMode;
  /** The model of the value. `undefined`: uncontrolled. */
  readonly value: unknown;
  readonly defaultValue: unknown;
  /** The model of the text. `undefined`: uncontrolled. */
  readonly text: string | undefined;
  readonly defaultText: string | undefined;
  readonly open: boolean | undefined;
  readonly defaultOpen: boolean;
  readonly items: unknown;
  readonly filteredItems: readonly unknown[] | undefined;
  readonly filter: ItemFilter | null | undefined;
  readonly limit: number;
  readonly locale: Intl.LocalesArgument | undefined;
  readonly grid: boolean;
  readonly virtualized: boolean;
  readonly inline: boolean;
  readonly modal: boolean;
  readonly highlightItemOnHover: boolean;
  readonly loopFocus: boolean;
  readonly openOnInputClick: boolean;
  readonly autoHighlight: boolean | 'always';
  readonly keepHighlight: boolean;
  readonly submitOnItemClick: boolean;
  readonly isItemEqualToValue: ((itemValue: any, value: any) => boolean) | undefined;
  readonly itemToStringLabel: ((value: any) => string) | undefined;
  readonly itemToStringValue: ((value: any) => string) | undefined;
  readonly autocomplete: string | undefined;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly readonly: boolean;
}

/** The events of a root. Each change event comes before its `update:*` event. */
export interface RootEmit {
  value: (value: unknown, details: ComboboxRootChangeEventDetails) => void;
  text: (text: string, details: ComboboxRootChangeEventDetails) => void;
  open: (open: boolean, details: ComboboxRootOpenChangeEventDetails) => void;
  updateValue: (value: unknown) => void;
  updateText: (text: string) => void;
  updateOpen: (open: boolean) => void;
  highlight: (value: unknown, details: ComboboxRootHighlightEventDetails) => void;
}

/** A mounted item: its value, its state and its text. */
export interface MountedItem {
  value: unknown;
  disabled: boolean;
  /** The text that the item renders. */
  text: string;
}

/** What a mounted item gives to its root. */
interface ItemEntry {
  value(): unknown;
  index(): number | undefined;
  disabled(): boolean;
}

/** What `Combobox.Root` and `Autocomplete.Root` give to their parts. The properties are reactive. */
export interface ComboboxRootContext {
  readonly family: 'Combobox' | 'Autocomplete';
  readonly root: PopupRoot;
  readonly layer: Layer;
  readonly list: List;
  readonly focus: ReturnType<typeof usePopupFocus>;
  readonly mode: SelectionMode;
  readonly completion: CompletionMode;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly grid: boolean;
  readonly inline: boolean;
  readonly openOnInputClick: boolean;
  readonly autoHighlight: boolean | 'always';
  /** The popup is open, or the list is in place. */
  readonly expanded: boolean;
  /** The selected value: a value or `null`, a list with `multiple`, the text in Autocomplete. */
  readonly value: unknown;
  readonly text: string;
  /** The text that the input shows: the text, or the inline completion of a key highlight. */
  readonly shownText: string;
  /** The text of the close for an input in a kept popup or a popup that leaves, until the leave ends or the next open. */
  readonly keptText: string | null;
  /** A fill of the browser keeps the closed popup in the DOM, so that its items stay mounted. */
  readonly keepsPopup: boolean;
  readonly hasValue: boolean;
  /** The data of `items`, or `undefined`. */
  readonly data: readonly unknown[] | undefined;
  /** The items that the filter keeps, in the form of `items`. */
  readonly filteredItems: readonly unknown[];
  /** The values of the items of `items`, with no groups. */
  readonly dataValues: readonly unknown[];
  /** The list has no item to show. */
  readonly empty: boolean;
  /** An `Input` outside a popup, or the root is `inline`: the input is the control. */
  readonly inputIsControl: boolean;
  /** The element of the control, while it is mounted. */
  readonly control: HTMLElement | null;
  /** The element of the `Input`, while one is mounted. */
  readonly input: HTMLElement | null;
  /** The default anchor of the positioner and the hole of the block. */
  readonly anchor: Element | null;
  readonly listId: string | undefined;
  readonly labelId: string | undefined;
  /** The id of the control. */
  readonly controlId: string;
  /** The positioner element, while it is mounted. */
  positioner: ShallowRef<HTMLElement | null>;
  /**
   * The positioner has a place. A positioner that stays mounted after a close keeps it until its
   * next place.
   */
  placed: ShallowRef<boolean>;
  /** The side of the popup, while a positioner places it. */
  side: ShallowRef<Side | null>;
  /** The side of the open popup, else `null`. */
  readonly popupSide: Side | null;
  popupFocus: ShallowRef<{ initialFocus?: FocusTarget; finalFocus?: FocusTarget }>;
  isSelected(value: unknown): boolean;
  /** The text of a value in the input. */
  labelOf(value: unknown): string;
  /** `labelOf` while `itemToStringLabel` or a collection gives the labels. */
  readonly labelFunction: ((value: unknown) => string) | undefined;
  /** The text of a value in the form data. */
  formTextOf(value: unknown): string;
  /** The mounted items, also those of a closed popup that stays in the DOM, in the order of the document. */
  mountedItems(): MountedItem[];
  /** The mounted items, else the items that were mounted at the last close. */
  lastItems(): MountedItem[];
  /** Asks for a change of the open state. */
  request(open: boolean, reason: ComboboxRootChangeEventReason, event: Event): void;
  /** Changes the text. Gives `false` when a listener cancelled the change. */
  setText(text: string, details: ComboboxRootChangeEventDetails): boolean;
  /** Changes the value. Gives `false` when a listener cancelled the change. */
  setValue(value: unknown, details: ComboboxRootChangeEventDetails): boolean;
  /** Picks the value of an item at a `click`. */
  select(value: unknown, event: MouseEvent): void;
  /**
   * The input got typed text, after its update of the text. `hadValue`: the root had a value
   * before the text, which an emptied text of a single combobox clears.
   */
  onTyped(text: string, event: Event, hadValue: boolean): void;
  /** The browser filled the input with a text that is no query. */
  onFilled(text: string): void;
  /** Keeps the closed popup in the DOM from now on. */
  keepPopup(): void;
  /** Puts back the text as a close does. */
  resetText(event: Event): void;
  /** A key on the control: the arrow keys of the list. Gives `true` when it used the key. */
  onListKeydown(event: KeyboardEvent): boolean;
  /** Clicks the highlighted item for a key. Gives `false` with no highlight. */
  clickHighlighted(event: KeyboardEvent): boolean;
  /** Removes the highlight of the item of a value that a chip removed. */
  unhighlight(value: unknown, event: Event): void;
  /** Opens for an arrow key, and highlights by the key after the items mounted. */
  openByKey(event: KeyboardEvent): void;
  /** The press of a mouse that opened the popup: its release selects the item under it, or closes. */
  readonly press: ReturnType<typeof usePopupPress>;
  addInput(input: {
    readonly insidePopup: boolean;
    readonly element: HTMLElement | null;
    readonly attrs: Record<string, unknown>;
    showText(): void;
  }): () => void;
  addTriggerName(attrs: Record<string, unknown>): () => void;
  listName(attrs: Record<string, unknown>): { 'aria-labelledby'?: string; 'aria-label'?: string };
  setTrigger(element: HTMLElement | null): () => void;
  setList(list: { readonly element: HTMLElement | null; readonly id: string }): () => void;
  setLabel(label: { readonly id: string }): () => void;
  addItem(element: HTMLElement, item: ItemEntry): () => void;
  /** Adds an element that is inside the layer: a group, a clear button, the chips. */
  addInside(element: () => Element | null): () => void;
  addInputGroup(element: () => Element | null): () => void;
  /** Adds an `Empty`. With none, an Escape on an empty list goes on to a popup around it. */
  addEmpty(): () => void;
  /** The hidden text input of the form, while it is mounted. */
  textInput: ShallowRef<HTMLInputElement | null>;
}

export const comboboxKey: InjectionKey<ComboboxRootContext> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'combobox root' : undefined,
);
/** The placement that a positioner gives to the popup and the arrow. */
export const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'combobox positioner' : undefined,
);
const portalKey: InjectionKey<true> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'combobox portal' : undefined,
);

export function createComboboxDetails(
  reason: ComboboxRootChangeEventReason,
  event: Event,
  isItemPress?: boolean,
): ComboboxRootChangeEventDetails {
  let isCanceled = false;
  let isPropagationAllowed = false;
  return {
    reason,
    event,
    ...(isItemPress !== undefined && { isItemPress }),
    cancel() {
      isCanceled = true;
    },
    get isCanceled() {
      return isCanceled;
    },
    allowPropagation() {
      isPropagationAllowed = true;
    },
    get isPropagationAllowed() {
      return isPropagationAllowed;
    },
  };
}

export function useComboboxRoot(source: RootSource, emit: RootEmit) {
  const field = inject(fieldKey, null);
  const generatedId = useId();
  const locale = useLocale(() => source.locale);
  const multiple = () => source.mode === 'multiple';

  // The items.
  const collection = computed(() => (isItemCollection(source.items) ? source.items : null));
  const data = computed(
    () =>
      (collection.value ? collection.value.data : source.items) as readonly unknown[] | undefined,
  );
  const isEqual = computed(() => source.isItemEqualToValue ?? defaultItemEquality);
  const toValue = (item: unknown) => (collection.value ? collection.value.value(item) : item);

  function labelOf(value: unknown): string {
    const items = collection.value;
    if (!items) return stringifyAsLabel(value, source.itemToStringLabel);
    return items.label(value, isEqual.value, (unknown) => {
      // A value that is not in the data can be in the items of `filteredItems`.
      const flat = source.filteredItems ? flattenLeafItems(source.filteredItems) : [];
      const item = flat.find((each) =>
        compareItemEquality(items.value(each), unknown, isEqual.value),
      );
      return item === undefined
        ? stringifyAsLabel(unknown, source.itemToStringLabel)
        : items.itemLabel(item);
    });
  }

  function formTextOf(value: unknown): string {
    if (source.itemToStringValue && value != null) return source.itemToStringValue(value) ?? '';
    if (value && typeof value === 'object' && 'value' in value && 'label' in value) {
      return stringifyAsLabel((value as { value: unknown }).value);
    }
    return stringifyAsLabel(value);
  }

  // The value and the text.
  const NO_VALUES: readonly unknown[] = EMPTY_ARRAY;
  const valueModelOf = (value: unknown) => (multiple() && value === null ? NO_VALUES : value);
  const firstValue =
    valueModelOf(source.value ?? source.defaultValue ?? null) ?? (multiple() ? NO_VALUES : null);
  const valueState = useModel(() => valueModelOf(source.value), firstValue);
  const valueModel = valueState.value;
  const value = computed(() => (source.mode === 'none' ? text.value : valueModel.value));

  // Vue gives `null` to the prop of a `v-model` whose ref is `null`: a controlled empty text.
  const givenText = () => ((source.text as string | null | undefined) === null ? '' : source.text);
  const followsLabel = () =>
    source.mode === 'single' && givenText() === undefined && source.defaultText === undefined;
  const firstText =
    givenText() ?? source.defaultText ?? (source.mode === 'single' ? labelOf(firstValue) : '');
  const textState = useModel(givenText, firstText);
  const text = textState.value;

  const hasValue = computed(() => {
    if (source.mode === 'none') return text.value !== '';
    return multiple() ? (valueModel.value as unknown[]).length > 0 : valueModel.value != null;
  });

  function isSelected(itemValue: unknown) {
    if (source.mode === 'none') return false;
    const current = valueModel.value;
    return multiple()
      ? selectedValueIncludes(current as unknown[], itemValue, isEqual.value)
      : compareItemEquality(itemValue, current, isEqual.value);
  }

  // The filter.
  const coreFilter = computed(() => getFilter({ locale: locale.value }));
  const itemToString = computed<FilterItemToString | undefined>(() => {
    const items = collection.value;
    if (!items) return source.itemToStringLabel;
    return Object.assign((item: unknown) => items.itemLabel(item), { selected: labelOf });
  });
  // The user typed text after the open.
  const typed = shallowRef(false);
  // With `autoHighlight`, the first item that mounts after the text gets the highlight.
  const highlightFirst = shallowRef(false);
  /**
   * The selected item gets the highlight when it mounts: at the mount of an inline list, and when
   * items mount after the open.
   */
  const highlightSelectedLater = shallowRef(false);
  // A kept popup or a popup that leaves in a `<Transition>` shows its exit after the close, so it
  // keeps the query and the text of its last open render until the leave ends or the next open
  // (test/measurements/combobox.test.ts, "a kept popup that closes").
  const kept = shallowRef<{ query: string; text: string } | null>(null);
  // The text of an autofill of the input, which is no query (Base UI).
  const filledText = shallowRef<string | null>(null);
  // With no `items`, the labels of a fill are the text of the items, so the popup stays from the
  // first fill on, as in Base UI.
  const keepsPopup = shallowRef(false);
  const liveQuery = computed(() => {
    const trimmed = text.value.trim();
    // A single combobox shows each item while its input shows the label of its value.
    if (source.mode === 'single' && !typed.value && trimmed === labelOf(valueModel.value).trim()) {
      return '';
    }
    if (!typed.value && text.value === filledText.value) return '';
    return trimmed;
  });
  const query = computed(() => (kept.value ? kept.value.query : liveQuery.value));
  const filteredItems = computed<readonly unknown[]>((previous) => {
    let next: readonly unknown[];
    if (source.filteredItems) next = source.filteredItems;
    else if (!data.value) next = EMPTY_ARRAY;
    else {
      const filter = source.filter;
      const queryText = query.value;
      const keepsEach =
        filter === null ||
        queryText === '' ||
        source.completion === 'inline' ||
        source.completion === 'none';
      // A list that keeps each item needs no filter, so the first mount makes no collator.
      let keeps: (item: unknown) => boolean = () => true;
      if (!keepsEach) {
        const matches: ItemFilter = filter ?? coreFilter.value.contains;
        const toLabel = itemToString.value;
        keeps = (item) => item != null && matches(item, queryText, toLabel);
      }
      next = filterItems(data.value as unknown[] | Group[], keeps, source.limit);
    }
    // The same items give the same list, so a key that keeps them renders no item.
    return previous && sameItems(previous, next) ? previous : next;
  });
  const filteredValues = computed(() =>
    flattenLeafItems(filteredItems.value as unknown[]).map(toValue),
  );
  const mountedItems = shallowRef(0);
  const empty = computed(() =>
    data.value !== undefined || source.filteredItems
      ? filteredValues.value.length === 0
      : mountedItems.value === 0,
  );

  // The parts.
  const inputs = shallowReactive<
    {
      readonly insidePopup: boolean;
      readonly element: HTMLElement | null;
      readonly attrs: Record<string, unknown>;
      showText(): void;
    }[]
  >([]);
  const triggerNames = shallowReactive<Record<string, unknown>[]>([]);
  const inputIsControl = computed(
    () => source.inline || inputs.some((input) => !input.insidePopup),
  );
  const controlInputEntry = computed(
    () => inputs.find((input) => source.inline || !input.insidePopup) ?? null,
  );
  const controlInput = computed(() => controlInputEntry.value?.element ?? null);
  const triggerElement = shallowRef<HTMLElement | null>(null);
  const control = computed(() =>
    inputIsControl.value ? controlInput.value : triggerElement.value,
  );
  const insideGetters = shallowReactive<(() => Element | null)[]>([]);
  const groupGetters = shallowReactive<(() => Element | null)[]>([]);
  const lists = shallowReactive<{ readonly element: HTMLElement | null; readonly id: string }[]>(
    [],
  );
  const labels = shallowReactive<{ readonly id: string }[]>([]);
  const empties = shallowRef(0);
  const textInput = shallowRef<HTMLInputElement | null>(null);
  // The form control of Autocomplete is its input outside the popup.
  const formElement = () =>
    textInput.value ??
    (source.mode === 'none' ? ((controlInput.value as HTMLInputElement | null) ?? null) : null);
  const inDisabledFieldset = useInDisabledFieldset(formElement);
  const disabled = computed(() => source.disabled || !!field?.disabled || inDisabledFieldset.value);
  const itemEntries = new Map<Element, ItemEntry>();
  const listElement = computed(() => lists.at(-1)?.element ?? null);

  const anchor = computed<Element | null>(() => {
    if (!inputIsControl.value) return triggerElement.value;
    const input = controlInput.value;
    const group = groupGetters
      .map((get) => get())
      .find((element) => !!input && !!element?.contains(input));
    return group ?? input;
  });

  // The popup.
  const root = usePopupRoot({
    name: source.family,
    open: () => source.open,
    defaultOpen: source.defaultOpen,
    triggerId: () => undefined,
    defaultTriggerId: null,
    handle: () => undefined,
    emitChange(open, details) {
      // With no `Empty`, a style hides the empty popup, and the Escape goes on to a popup around.
      if (!open && details.reason === 'escape-key' && empty.value && empties.value === 0) {
        details.allowPropagation();
      }
      emit.open(open, details as ComboboxRootOpenChangeEventDetails);
    },
    emitOpen: emit.updateOpen,
    emitTriggerId: () => {},
  });

  const positioner = shallowRef<HTMLElement | null>(null);
  const placed = shallowRef(false);
  const side = shallowRef<Side | null>(null);
  const fullWidth = useFullWidth(positioner, placed);
  const layer = useLayer(root, () => {
    const modal = source.modal && !source.inline && !!positioner.value;
    return {
      escape: !source.inline,
      outsidePress: !source.inline,
      focusOut: !source.inline,
      pressStart: true,
      block: modal,
      hide: false,
      trap: false,
      lockScroll: modal && (root.interaction !== 'touch' || fullWidth.value),
      hole: anchor.value,
      inside: insideGetters.map((get) => get()),
      triggerInUse: true,
    };
  });
  useScrollLock(
    () => root.open && layer.lockScroll,
    () => root.activeTrigger,
  );
  const popupFocus = shallowRef<{ initialFocus?: FocusTarget; finalFocus?: FocusTarget }>({});
  const focus = usePopupFocus(root, layer, {
    takesFocus: () => !inputIsControl.value,
    placed: () => placed.value,
    initialFocus: () => popupFocus.value.initialFocus,
    finalFocus: () => popupFocus.value.finalFocus,
    tabIntoPopup: () => inputIsControl.value,
    inputKeepsFocus: () => inputIsControl.value && !source.inline,
  });
  const expanded = computed(() => root.open || source.inline);

  // The highlight.
  let lastHighlight: { value: unknown; index: number } = { value: undefined, index: -1 };
  // The value of the last pick, which gets the highlight back when the text empties.
  let lastPick: { value: unknown } | undefined;
  const completion = shallowRef<string | null>(null);

  function indexOf(item: ListItem) {
    const entry = itemEntries.get(item.element);
    const given = entry?.index();
    if (given !== undefined) return given;
    if (source.virtualized)
      return findItemIndex(filteredValues.value, entry?.value(), isEqual.value);
    return list.indexOf(item);
  }

  function emitHighlight(
    item: unknown,
    index: number,
    reason: ComboboxRootHighlightEventDetails['reason'],
    event: Event | undefined,
  ) {
    if (Object.is(item, lastHighlight.value) && index === lastHighlight.index) return;
    lastHighlight = { value: item, index };
    emit.highlight(item, { reason, event, index });
  }

  const list = useList({
    orientation: () => 'vertical',
    loop: () => source.loopFocus,
    container: () => listElement.value,
    owner: () => control.value,
    canLeave: () => source.loopFocus && !source.autoHighlight,
    hover: () => source.highlightItemOnHover,
    keepOnLeave: () => source.keepHighlight,
    rows: () => source.grid,
    onHighlight(item, reason, event) {
      // An inline completion shows the text of an item that a key highlights. A read-only root
      // keeps its text.
      const completes =
        !source.readonly && (source.completion === 'both' || source.completion === 'inline');
      completion.value = completes && item && reason === 'keyboard' ? labelOf(valueOf(item)) : null;
      if (item) emitHighlight(valueOf(item), highlightedIndex.value, reason, event);
      else if (!source.virtualized || reason !== 'none')
        emitHighlight(undefined, -1, reason, event);
      // A highlight of the user wins over a highlight that waits for its item.
      if (reason !== 'none') highlightSelectedLater.value = false;
    },
  });
  // The event of a highlight step and the watcher below read one count of the items.
  const highlightedIndex = computed(() => (list.highlighted ? indexOf(list.highlighted) : -1));
  // An item that changes its value, or its place in the list, gives a new highlight event. A new
  // highlight already gave its event in `onHighlight`, with this value and index.
  watch(
    [() => list.highlighted && valueOf(list.highlighted), highlightedIndex],
    ([itemValue, index]) => {
      if (list.highlighted) emitHighlight(itemValue, index, 'none', undefined);
    },
    { flush: 'post' },
  );

  function valueOf(item: ListItem) {
    return itemEntries.get(item.element)?.value();
  }

  function itemOfIndex(index: number) {
    return list.find((item) => indexOf(item) === index) ?? null;
  }

  function highlightSelected() {
    const pick = lastPick;
    const picked =
      pick && isSelected(pick.value)
        ? list.find((item) => compareItemEquality(valueOf(item), pick.value, isEqual.value))
        : undefined;
    const selected = picked ?? list.find((item) => isSelected(valueOf(item)));
    if (selected) list.highlight(selected, 'none');
    else if (source.virtualized && hasValue.value && source.mode !== 'none') {
      const index = filteredValues.value.findIndex((each) => isSelected(each));
      if (index !== -1) emitHighlight(filteredValues.value[index], index, 'none', undefined);
    }
    return !!selected;
  }

  // A root that turns read-only drops the inline text of the highlight.
  watch(
    () => source.readonly,
    (readonly) => {
      if (readonly) completion.value = null;
    },
  );

  // Vue patches a popup that leaves, so it keeps the query and text of its last open render. This
  // also holds when a pick or the parent changes the text at the close.
  watch([() => root.open, liveQuery, text] as const, ([open], [wasOpen, openQuery, openText]) => {
    if (open) kept.value = null;
    else if (wasOpen) {
      kept.value = root.keepMounted || root.leaving ? { query: openQuery, text: openText } : null;
    }
  });
  watch(
    () => root.keepMounted || root.leaving,
    (keeps) => {
      if (!keeps) kept.value = null;
    },
  );

  // The key that opened the popup, for the highlight after the items mounted.
  let openKey: KeyboardEvent | undefined;
  watch(
    () => root.open,
    (open) => {
      typed.value = false;
      completion.value = null;
      highlightFirst.value = false;
      highlightSelectedLater.value = false;
      const key = openKey;
      openKey = undefined;
      if (!open) {
        list.highlight(null, 'none');
        // The highlight event of no item resets the last highlight. A virtualized list emits none
        // for a highlight that it removes.
        if (source.virtualized) lastHighlight = { value: undefined, index: -1 };
        resetText(new Event('vase-ui'), root.reason === 'item-press');
        return;
      }
      // The items mount in this update.
      void nextTick(() => {
        if (!root.open || list.highlighted) return;
        if (highlightSelected()) return;
        if (hasValue.value && source.mode !== 'none' && !list.find()) {
          highlightSelectedLater.value = true;
          return;
        }
        if (source.autoHighlight === 'always') {
          list.highlight(list.find() ?? null, 'none');
        } else if (key && (source.mode !== 'none' || source.autoHighlight)) {
          list.highlight(
            list.edge(key.key === 'ArrowUp' ? 'last' : 'first') ?? null,
            'keyboard',
            key,
          );
        }
      });
    },
  );

  // At a close, the text goes back: the label of the value in an input outside the popup, else
  // no text. Autocomplete keeps its text, which is its value. Gives `false` when the text stays.
  function resetText(event: Event, itemPress = false) {
    if (source.mode === 'none') return false;
    if (source.mode === 'single' && inputIsControl.value && !source.inline) {
      const label = labelOf(valueModel.value);
      return setText(label, createComboboxDetails(label === '' ? 'input-clear' : 'none', event));
    }
    if (text.value === '' || (source.inline && source.mode === 'single')) return true;
    return setText('', createComboboxDetails('input-clear', event, itemPress));
  }

  onMounted(() => {
    // An input in the popup starts with no text: the label of the value is in the trigger.
    if (followsLabel() && !inputIsControl.value) textState.setOwn('');
    // An inline list gives the highlight to the selected item once it mounts, as in Base UI.
    if (source.inline && hasValue.value && source.mode !== 'none') {
      highlightSelectedLater.value = true;
    }
  });

  // The text of a single combobox follows the label of its value at a new label and at new
  // `items` (Base UI). A typed text stays, and so does a text that the user emptied in the same
  // update. An open by a typed text ends `typed`, so new `items` keep each text that is a query.
  // An inline list shows its value, so it keeps an emptied text at new `items`, as at a blur. A
  // form reset gives the text with no change event, after the parent answers the update of the
  // value.
  let resetTextWaits = false;
  watch(
    [() => labelOf(valueModel.value), () => source.items, text] as const,
    ([label, items, current], [oldLabel, oldItems, previous]) => {
      if (!followsLabel() || !inputIsControl.value || current === label || resetTextWaits) return;
      const newLabel = label !== oldLabel;
      if (!newLabel && (items === oldItems || source.inline)) return;
      const ofUser =
        current === ''
          ? typed.value && current !== previous
          : typed.value || (!newLabel && query.value !== '');
      if (ofUser) return;
      if (setText(label, createComboboxDetails('none', new Event('vase-ui')))) typed.value = false;
    },
  );

  // The field.
  watch([value, hasValue], ([current, filled]) => field?.setValue(current, filled), {
    immediate: true,
  });

  // The commands.
  function setText(next: string, details: ComboboxRootChangeEventDetails) {
    if (next === text.value && completion.value === null) return true;
    completion.value = null;
    if (next === text.value) return true;
    emit.text(next, details);
    if (details.isCanceled) return false;
    // A new text cancels the highlight of a later first item.
    highlightFirst.value = false;
    textState.setOwn(next);
    emit.updateText(next);
    // The field reads the validity of the form input after its render.
    if (source.mode === 'none') void nextTick(() => field?.onEdit());
    return true;
  }

  function setValue(next: unknown, details: ComboboxRootChangeEventDetails) {
    emit.value(next, details);
    if (details.isCanceled) return false;
    valueState.setOwn(next);
    emit.updateValue(next);
    void nextTick(() => field?.onEdit());
    return true;
  }

  function request(open: boolean, reason: ComboboxRootChangeEventReason, event: Event) {
    root.request(open, reason, event);
  }

  // The key event that sends a `click` to an item, for the details of the pick.
  let keyOfClick: KeyboardEvent | undefined;

  function select(itemValue: unknown, event: MouseEvent) {
    if (disabled.value || source.readonly) return;
    const pick = keyOfClick ?? event;
    const details = createComboboxDetails('item-press', pick);
    // A link in an item does its own action.
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (link) {
      if (link.getAttribute('href')?.startsWith('#')) request(false, 'item-press', pick);
      return;
    }
    if (source.mode === 'none') {
      setText(labelOf(itemValue), details);
      if (details.isCanceled) return;
      request(false, 'item-press', pick);
      if (source.submitOnItemClick) void nextTick(requestSubmit);
      return;
    }
    if (multiple()) {
      const current = valueModel.value as unknown[];
      const selected = selectedValueIncludes(current, itemValue, isEqual.value);
      const next = selected
        ? removeItem(current, itemValue, isEqual.value)
        : [...current, itemValue];
      if (!setValue(next, details)) return;
      if (!selected) lastPick = { value: itemValue };
      if (text.value.trim() === '') return;
      if (inputIsControl.value && !source.inline) {
        request(false, 'item-press', pick);
        return;
      }
      if (!setText('', createComboboxDetails('input-clear', pick, true))) return;
      // With the whole list back, the highlight goes to the picked item, also when the parent
      // refused it, or after a deselect to the first selected item, as in Base UI.
      void nextTick(() => {
        if (!expanded.value) return;
        const item = selected
          ? undefined
          : list.find((each) => compareItemEquality(valueOf(each), itemValue, isEqual.value));
        if (item) list.highlight(item, 'none');
        else if (!highlightSelected()) list.highlight(null, 'none');
      });
      return;
    }
    if (
      !compareItemEquality(itemValue, valueModel.value, isEqual.value) &&
      !setValue(itemValue, details)
    ) {
      return;
    }
    lastPick = { value: itemValue };
    if (inputIsControl.value)
      setText(labelOf(itemValue), createComboboxDetails('item-press', pick));
    request(false, 'item-press', pick);
  }

  function requestSubmit() {
    const form = textInput.value?.form ?? (controlInput.value as HTMLInputElement | null)?.form;
    form?.requestSubmit();
  }

  function onTyped(typedText: string, event: Event, hadValue: boolean) {
    typed.value = true;
    filledText.value = null;
    highlightSelectedLater.value = false;
    completion.value = null;
    const hasText = typedText.trim() !== '';
    // With `autoHighlight`, an emptied text gives the highlight to the selected item. With no
    // value, it keeps the highlighted item (Base UI).
    const previous =
      !hasText && source.autoHighlight === true && !hadValue ? list.highlighted : null;
    if (!previous) {
      list.highlight(null, 'none', event);
      // A virtual list keeps the highlight of a value whose item leaves the window. Typed text
      // removes that highlight too.
      if (source.virtualized) emitHighlight(undefined, -1, 'none', event);
    }
    // Each typed text shows the list from its top.
    const first = list.find()?.element ?? listElement.value;
    if (!source.virtualized && first) resetScroll(first);
    if (hasText && !disabled.value && !source.readonly) request(true, 'input-change', event);
    void nextTick(() => {
      if (!expanded.value) return;
      if (hasText ? !!source.autoHighlight : source.autoHighlight === 'always') {
        const item = list.find();
        if (item) list.highlight(item, 'none');
        // Items that come later, such as the results of a request, get the highlight.
        else highlightFirst.value = true;
        return;
      }
      // A text that the parent keeps is no emptied text, so the selected item gets no highlight.
      if (!hasText && text.value.trim() === '') highlightSelected();
    });
  }

  // The first item of `autoHighlight` waits only for its typed text, while `autoHighlight` is on.
  watch(
    () => text.value.trim() === '' || !source.autoHighlight,
    (drop) => {
      if (drop) highlightFirst.value = false;
    },
  );
  // The selected item gets the highlight when it mounts.
  watch(
    () =>
      highlightSelectedLater.value && expanded.value
        ? list.find((item) => isSelected(valueOf(item)))
        : undefined,
    (item) => {
      if (!item) return;
      highlightSelectedLater.value = false;
      list.highlight(item, 'none');
    },
    { flush: 'post' },
  );
  watch(
    () => (highlightFirst.value ? list.find() : undefined),
    (item) => {
      if (!item) return;
      highlightFirst.value = false;
      // An inline list has a highlight only while its input has the focus, as in ComboboxInput.
      const input = control.value;
      const away = !!input && activeElement(ownerDocument(input)) !== input;
      if (source.inline && source.autoHighlight !== 'always' && away) return;
      list.highlight(item, 'none');
    },
    { flush: 'post' },
  );

  function resetScroll(from: Element) {
    const popup = root.popup;
    for (let node = from.parentElement; node; node = node.parentElement) {
      const style = ownerWindow(node).getComputedStyle(node);
      if (/auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        node.scrollTop = 0;
        return;
      }
      if (node === popup) return;
    }
  }

  // A virtual window has the items of only some values, so the keys count on the values. The keys
  // give the moves of a list that is not virtual.
  function onListKeydown(event: KeyboardEvent) {
    if (!source.virtualized) return list.onKeydown(event);
    if (event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return false;
    const current = lastHighlight.index;
    const rowStep = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    const cellStep = source.grid && current !== -1 ? stepInRow(event.key) : 0;
    if (rowStep === 0 && cellStep === 0) return false;
    const count = filteredValues.value.length;
    if (count === 0) return false;
    event.preventDefault();
    const next =
      cellStep === 0 ? nextRow(current, rowStep, count) : nextCell(current, cellStep, count);
    emitHighlight(next === -1 ? undefined : filteredValues.value[next], next, 'keyboard', event);
    // An item that is not mounted gets the highlight when it mounts.
    const target = next === -1 ? null : itemOfIndex(next);
    list.highlight(target, target || next === -1 ? 'keyboard' : 'none', event);
    return true;
  }

  // ArrowRight moves forward in a row, and ArrowLeft in a right-to-left list.
  function stepInRow(key: string) {
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return 0;
    const element = listElement.value;
    const rtl = !!element && ownerWindow(element).getComputedStyle(element).direction === 'rtl';
    return (key === 'ArrowRight') !== rtl ? 1 : -1;
  }

  // The value of the same column in the next row. A shorter last row gives its last value.
  function nextRow(current: number, step: number, count: number) {
    if (current === -1) return step === 1 ? 0 : count - 1;
    const columns = source.grid ? columnCount() : 1;
    const rows = Math.ceil(count / columns);
    let row = Math.floor(current / columns) + step;
    if (row < 0 || row >= rows) {
      if (source.loopFocus && !source.autoHighlight) return -1;
      if (!source.loopFocus) return current;
      row = step === 1 ? 0 : rows - 1;
    }
    return Math.min(row * columns + (current % columns), count - 1);
  }

  function nextCell(current: number, step: number, count: number) {
    const next = current + step;
    if (next >= 0 && next < count) return next;
    if (!source.loopFocus) return current;
    return step === 1 ? 0 : count - 1;
  }

  // The rows of a virtual window have the columns of the full grid, and the last row can be
  // shorter.
  function columnCount() {
    const counts = new Map<Element | null, number>();
    for (const { element } of list.items()) {
      const row = element.closest('[role="row"]');
      counts.set(row, (counts.get(row) ?? 0) + 1);
    }
    return Math.max(1, ...counts.values());
  }

  function clickHighlighted(event: KeyboardEvent) {
    const item = list.highlighted;
    if (!item) return false;
    keyOfClick = event;
    try {
      dispatchClickWithModifiers(item.element, event);
    } finally {
      keyOfClick = undefined;
    }
    return true;
  }

  function openByKey(event: KeyboardEvent) {
    openKey = event;
    request(true, 'list-navigation', event);
    if (!root.open) openKey = undefined;
  }

  const press = usePopupPress(root, {
    itemAt(path) {
      const item = list.find(({ element }) => path.includes(element));
      return item && !item.disabled ? item.element : null;
    },
    inside: (element) => isInPopup(layer, element) || !!layer.inside?.includes(element),
    virtual: true,
  });

  function add<T>(collection: T[], item: T) {
    collection.push(item);
    return () => {
      const index = collection.indexOf(item);
      if (index !== -1) collection.splice(index, 1);
    };
  }

  function readMountedItems() {
    return inDocumentOrder(
      [...itemEntries].filter(([element]) => element.isConnected),
      ([element]) => element,
      listElement.value,
    ).map(([element, entry]) => ({
      value: entry.value(),
      disabled: entry.disabled(),
      text: element.textContent?.trim() ?? '',
    }));
  }
  // The items of the last close, for the typeahead of a closed trigger after its popup unmounted
  // them, as in Base UI.
  let closedItems: MountedItem[] = [];
  watch(
    () => root.open,
    (open) => {
      if (!open) closedItems = readMountedItems();
    },
    { flush: 'sync' },
  );

  const context: ComboboxRootContext = {
    family: source.family,
    root,
    layer,
    list,
    focus,
    get mode() {
      return source.mode;
    },
    get completion() {
      return source.completion;
    },
    get disabled() {
      return disabled.value;
    },
    get readonly() {
      return source.readonly;
    },
    get required() {
      return source.required;
    },
    get name() {
      return field?.name ?? source.name;
    },
    get form() {
      return source.form;
    },
    get grid() {
      return source.grid;
    },
    get inline() {
      return source.inline;
    },
    get openOnInputClick() {
      return source.openOnInputClick;
    },
    get autoHighlight() {
      return source.autoHighlight;
    },
    get expanded() {
      return expanded.value;
    },
    get value() {
      return value.value;
    },
    get text() {
      return text.value;
    },
    get shownText() {
      return completion.value ?? text.value;
    },
    get keptText() {
      return kept.value?.text ?? null;
    },
    get keepsPopup() {
      return keepsPopup.value;
    },
    get hasValue() {
      return hasValue.value;
    },
    get data() {
      return data.value;
    },
    get filteredItems() {
      return filteredItems.value;
    },
    get dataValues() {
      return data.value ? flattenLeafItems(data.value as unknown[]).map(toValue) : EMPTY_ARRAY;
    },
    get empty() {
      return empty.value;
    },
    get inputIsControl() {
      return inputIsControl.value;
    },
    get control() {
      return control.value;
    },
    get input() {
      return controlInput.value ?? inputs[0]?.element ?? null;
    },
    get anchor() {
      return anchor.value;
    },
    get listId() {
      const last = lists.at(-1);
      return last?.element ? last.id : undefined;
    },
    get labelId() {
      return labels.at(-1)?.id;
    },
    get controlId() {
      return field?.controlId ?? generatedId;
    },
    positioner,
    placed,
    side,
    get popupSide() {
      return root.open ? side.value : null;
    },
    popupFocus,
    isSelected,
    labelOf,
    get labelFunction() {
      return collection.value || source.itemToStringLabel ? labelOf : undefined;
    },
    formTextOf,
    mountedItems: readMountedItems,
    lastItems() {
      const mounted = readMountedItems();
      return mounted.length > 0 || root.open ? mounted : closedItems;
    },
    request,
    setText,
    setValue,
    select,
    onTyped,
    onFilled(filled) {
      filledText.value = filled;
    },
    keepPopup() {
      keepsPopup.value = true;
    },
    resetText(event) {
      // The text that goes back is no typed text, so it follows a new label of the value.
      if (resetText(event)) typed.value = false;
    },
    onListKeydown,
    clickHighlighted,
    unhighlight(itemValue, event) {
      const item = list.highlighted;
      if (!item || !compareItemEquality(valueOf(item), itemValue, isEqual.value)) return;
      list.highlight(null, event.type.startsWith('key') ? 'keyboard' : 'pointer', event);
    },
    openByKey,
    press,
    addInput: (input) => add(inputs, input),
    addTriggerName: (attrs) => add(triggerNames, attrs),
    listName(attrs) {
      const controlAttrs = inputIsControl.value
        ? controlInputEntry.value?.attrs
        : triggerNames.at(-1);
      return listNameFromControl(
        attrs,
        controlAttrs,
        [labels.at(-1)?.id, field?.labelledBy].filter(Boolean).join(' ') || undefined,
        field?.hasLabel ? field.labelId : undefined,
      );
    },
    setTrigger(element) {
      triggerElement.value = element;
      return () => {
        if (triggerElement.value === element) triggerElement.value = null;
      };
    },
    setList: (entry) => add(lists, entry),
    // A template can mount the new label before it unmounts the old one.
    setLabel: (label) => add(labels, label),
    addItem(element, item) {
      itemEntries.set(element, item);
      mountedItems.value += 1;
      // The item of the value that a key reached in a virtual window gets the highlight.
      if (source.virtualized && lastHighlight.index !== -1) {
        const listItem = list.find((each) => each.element === element);
        if (listItem && indexOf(listItem) === lastHighlight.index) list.highlight(listItem, 'none');
      }
      return () => {
        if (itemEntries.get(element) === item) itemEntries.delete(element);
        mountedItems.value -= 1;
      };
    },
    addInside: (element) => add(insideGetters, element),
    addInputGroup: (element) => add(groupGetters, element),
    addEmpty() {
      empties.value += 1;
      return () => (empties.value -= 1);
    },
    textInput,
  };
  provide(comboboxKey, context);

  const mounted = useIsHydrated();
  const form = useComboboxForm(context, {
    autocomplete: () => source.autocomplete,
    // Autocomplete renders its inputs after its mount, so the server HTML has one name.
    rendersInputs: () => source.mode !== 'none' || (mounted.value && !inputIsControl.value),
    formElement,
    isEqual: () => isEqual.value,
    reset() {
      const resetValue = valueState.resetValue(
        valueModelOf(source.defaultValue ?? null) ?? (multiple() ? NO_VALUES : null),
      );
      if (
        source.mode !== 'none' &&
        isSelectedValueDirty(valueModel.value, resetValue, isEqual.value)
      ) {
        valueState.setOwn(resetValue);
        emit.updateValue(resetValue);
      }
      const resetText = () => {
        const next = textState.resetValue(
          source.defaultText ??
            (source.mode === 'single' && inputIsControl.value ? labelOf(valueModel.value) : ''),
        );
        if (text.value !== next) {
          textState.setOwn(next);
          emit.updateText(next);
        }
        // The reset empties a `<textarea>`, and Vue writes the text again only when it changes
        // (test/measurements/input.test.ts).
        for (const input of inputs) input.showText();
      };
      if (!followsLabel() || !inputIsControl.value) {
        resetText();
        return;
      }
      // A parent that controls the value answers the update in its next render. The text then
      // shows the label of the value that holds.
      resetTextWaits = true;
      void nextTick(() => {
        resetTextWaits = false;
        resetText();
      });
    },
  });

  return {
    context,
    root,
    form,
    /** Asks for a close with the reason `'imperative-action'`. */
    close() {
      request(false, 'imperative-action', new Event('vase-ui'));
    },
  };
}

/**
 * The root of the part. A part with no root throws an error that names it. Autocomplete uses the
 * parts of Combobox, so a part that is not `Autocomplete.Value` names the two families.
 */
export function injectComboboxRoot(part: string, family?: 'Autocomplete') {
  const context = inject(comboboxKey, null);
  if (context) return context;
  throw family ? createError(12, part) : createError(13, part);
}

/**
 * The trigger is the control. A part renders the answer of its `setup` until its mount, so the
 * server HTML and the first render agree. After the mount it follows the parts that mount later.
 */
export function useTriggerIsControl(context: ComboboxRootContext) {
  const first = !context.inputIsControl;
  const mounted = useIsHydrated();
  return computed(() => (mounted.value ? !context.inputIsControl : first));
}

/** Marks the parts in a portal. */
export function providePortal() {
  provide(portalKey, true);
}

/** The positioner and the backdrop need a portal of their root. */
export function injectPortal(context: ComboboxRootContext, part: string) {
  if (!inject(portalKey, false)) {
    throw createError(14, context.family, part);
  }
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(context: ComboboxRootContext, part: string) {
  const placement = inject(positionerKey, null);
  if (!placement) {
    throw createError(15, context.family, part);
  }
  return placement;
}

// The elements that handle their own press: a control, a link, an editable element, a button role
// and a tab stop.
const INTERACTIVE =
  'button,a[href],[role="button"],select,input,textarea,[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])';

/**
 * A press on the group of the input or on the chips, out of their buttons and their input, moves
 * the focus to the input and opens the popup, as a press on the input does. A press on a chip gives
 * it no focus.
 */
export function pressAroundInput(context: ComboboxRootContext, event: MouseEvent) {
  const target = event.target as Element | null;
  const around = event.currentTarget as Element;
  if (event.button !== 0 || !target || !around.contains(target)) return;
  const interactive = target === around ? null : target.closest(INTERACTIVE);
  if (interactive && around.contains(interactive)) return;
  event.preventDefault();
  const input = context.inputIsControl ? context.control : null;
  if (!input || context.disabled) return;
  input.focus();
  if (context.openOnInputClick) context.request(true, 'input-press', event);
}

/** The part is in a popup: its positioner is around it. */
export function useInPopup() {
  return !!inject(positionerKey, null);
}

/** What `Chips` gives to its chips and to the input in it. */
export interface ChipsContext {
  /** The direction of the chips element is right to left. */
  rtl(): boolean;
  /** Moves the focus to the chip at the index, -1 for the last chip. Gives `false` with no chip there. */
  focusChip(index: number): boolean;
  addChip(element: HTMLElement): () => void;
  /** The place of the chip among the chips, which is the place of its value. */
  indexOf(element: HTMLElement): number;
}

export const chipsKey: InjectionKey<ChipsContext> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'combobox chips' : undefined,
);

/** What a `Chip` gives to its `ChipRemove`. */
export interface ChipContext {
  readonly element: HTMLElement | null;
  readonly disabled: boolean;
}

export const chipKey: InjectionKey<ChipContext> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'combobox chip' : undefined,
);

export function injectChips() {
  return inject(chipsKey, null);
}

/** The chips around a chip part. A part with no chips throws an error that names it. */
export function injectChipsOf(part: string) {
  const chips = inject(chipsKey, null);
  if (!chips) {
    throw createError(16, part);
  }
  return chips;
}

/** An item in a `Row` is a cell of a grid. */
export const rowKey: InjectionKey<boolean> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'combobox row' : undefined,
);

/** What a `Group` gives to its label. */
export const groupKey: InjectionKey<{ addLabel(label: { readonly id: string }): () => void }> =
  Symbol(process.env.NODE_ENV !== 'production' ? 'combobox group' : undefined);

/**
 * The items that the filter of the root keeps, in the form of `items`. Call it in the `setup` of a
 * component in the root. Read the list only: the root can share it.
 */
export function useFilteredItems<T>(): ComputedRef<T[]> {
  const context = inject(comboboxKey, null);
  if (!context) {
    throw createError(17);
  }
  return computed(() => context.filteredItems as T[]);
}
