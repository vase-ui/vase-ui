import {
  computed,
  inject,
  nextTick,
  onMounted,
  onScopeDispose,
  provide,
  shallowReactive,
  shallowRef,
  useId,
  watch,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { addEventListener } from '../common/addEventListener';
import { EMPTY_ARRAY } from '../common/empty';
import { useIsHydrated } from '../common/hydration';
import { useModel } from '../common/model';
import { ownerDocument, ownerWindow } from '../common/owner';
import { fieldKey } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import { getFilter } from '../internals/filter';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  isSelectedValueDirty,
  removeItem,
  selectedValueIncludes,
} from '../internals/itemEquality';
import { flattenLeafItems, stringifyAsLabel, type Group } from '../internals/resolveValueLabel';
import { useList, type List, type ListItem } from '../list/list';
import { useLocale } from '../locale-provider/part';
import { usePopupFocus, type FocusTarget } from '../popup/focus';
import { isInPopup, useLayer, type Layer } from '../popup/layer';
import type { Side, usePlacement } from '../popup/placement';
import { usePopupRoot, type PopupRoot } from '../popup/root';
import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';
import { isReleaseAtPressPoint } from '../utils/popups/isReleaseAtPressPoint';
import { filterItems, sameItems, type FilterItemToString, type ItemFilter } from './filter';
import { useComboboxForm } from './form';
import { isItemCollection, type ItemCollection } from './items';
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
  value(value: unknown, details: ComboboxRootChangeEventDetails): void;
  text(text: string, details: ComboboxRootChangeEventDetails): void;
  open(open: boolean, details: ComboboxRootOpenChangeEventDetails): void;
  updateValue(value: unknown): void;
  updateText(text: string): void;
  updateOpen(open: boolean): void;
  highlight(value: unknown, details: ComboboxRootHighlightEventDetails): void;
}

/** What a mounted item gives to its root. */
interface ItemEntry {
  value(): unknown;
  index(): number | undefined;
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
  readonly virtualized: boolean;
  readonly openOnInputClick: boolean;
  readonly autoHighlight: boolean | 'always';
  /** The popup is open, or the list is in place. */
  readonly expanded: boolean;
  /** The selected value: a value or `null`, a list with `multiple`, the text in Autocomplete. */
  readonly value: unknown;
  readonly text: string;
  /** The text that the input shows: the text, or the inline completion of a key highlight. */
  readonly shownText: string;
  readonly hasValue: boolean;
  /** The data of `items`, or `undefined`. */
  readonly data: readonly unknown[] | undefined;
  /** The items that the filter keeps, in the form of `items`. */
  readonly filteredItems: readonly unknown[];
  /** The values of the filtered items, with no groups. */
  readonly filteredValues: readonly unknown[];
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
  /** The positioner has its first place for this open. */
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
  /** The value of a mounted item. */
  valueOf(item: ListItem): unknown;
  /** Asks for a change of the open state. */
  request(open: boolean, reason: ComboboxRootChangeEventReason, event: Event): void;
  /** Changes the text. Gives `false` when a listener cancelled the change. */
  setText(text: string, details: ComboboxRootChangeEventDetails): boolean;
  /** Changes the value. Gives `false` when a listener cancelled the change. */
  setValue(value: unknown, details: ComboboxRootChangeEventDetails): boolean;
  /** Picks the value of an item at a `click`. */
  select(value: unknown, event: MouseEvent): void;
  /** The input got typed text, after its update of the text. */
  onTyped(text: string, event: Event): void;
  /** A key on the control: the arrow keys of the list. Gives `true` when it used the key. */
  onListKeydown(event: KeyboardEvent): boolean;
  /** Clicks the highlighted item for a key. Gives `false` with no highlight. */
  clickHighlighted(event: KeyboardEvent): boolean;
  /** Opens for an arrow key, and highlights by the key after the items mounted. */
  openByKey(event: KeyboardEvent): void;
  /** A mouse press opened the popup: its release selects the item under it, or closes. */
  startDrag(press: PointerEvent): void;
  /** Requests the submit of the form of the root. */
  requestSubmit(): void;
  addInput(input: { readonly insidePopup: boolean; readonly element: HTMLElement | null }): () => void;
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

export const comboboxKey: InjectionKey<ComboboxRootContext> = Symbol('combobox root');
/** The placement that a positioner gives to the popup and the arrow. */
export const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> =
  Symbol('combobox positioner');
const portalKey: InjectionKey<true> = Symbol('combobox portal');

// A popup that covers the view leaves no room for a swipe outside, so a touch open locks the page.
const FULL_WIDTH_TOLERANCE = 20;

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
  const collection = computed(() =>
    isItemCollection(source.items) ? (source.items as ItemCollection) : null,
  );
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
      const item = flat.find((each) => compareItemEquality(items.value(each), unknown, isEqual.value));
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
  const firstValue = valueModelOf(source.value ?? source.defaultValue ?? null) ?? (multiple() ? NO_VALUES : null);
  const { value: valueModel, setOwn: setOwnValue } = useModel(
    () => valueModelOf(source.value),
    firstValue,
  );
  const value = computed(() => (source.mode === 'none' ? text.value : valueModel.value));

  const followsLabel = () =>
    source.mode === 'single' && source.text === undefined && source.defaultText === undefined;
  const firstText =
    source.text ??
    source.defaultText ??
    (source.mode === 'single' ? labelOf(firstValue) : '');
  const { value: text, setOwn: setOwnText } = useModel(() => source.text, firstText);

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
  const query = computed(() => {
    const trimmed = text.value.trim();
    // A single combobox shows each item while its input shows the label of its value.
    if (source.mode === 'single' && !typed.value && trimmed === labelOf(valueModel.value).trim()) {
      return '';
    }
    return trimmed;
  });
  const filteredItems = computed<readonly unknown[]>((previous) => {
    let next: readonly unknown[];
    if (source.filteredItems) next = source.filteredItems;
    else if (!data.value) next = EMPTY_ARRAY;
    else {
      const filter = source.filter;
      const keepsEach =
        filter === null ||
        query.value === '' ||
        source.completion === 'inline' ||
        source.completion === 'none';
      const matches: ItemFilter =
        filter ?? ((item, q, toString) => coreFilter.value.contains(item, q, toString));
      next = filterItems(
        data.value as unknown[] | Group[],
        keepsEach ? () => true : (item) => item != null && matches(item, query.value, itemToString.value),
        source.limit,
      );
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
  const inputs = shallowReactive<{ readonly insidePopup: boolean; readonly element: HTMLElement | null }[]>([]);
  const inputIsControl = computed(() => source.inline || inputs.some((input) => !input.insidePopup));
  const controlInput = computed(
    () => inputs.find((input) => source.inline || !input.insidePopup)?.element ?? null,
  );
  const triggerElement = shallowRef<HTMLElement | null>(null);
  const control = computed(() => (inputIsControl.value ? controlInput.value : triggerElement.value));
  const insideGetters = shallowReactive<(() => Element | null)[]>([]);
  const groupGetters = shallowReactive<(() => Element | null)[]>([]);
  const lists = shallowReactive<{ readonly element: HTMLElement | null; readonly id: string }[]>([]);
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
    const group = groupGetters.map((get) => get()).find((element) => !!input && !!element?.contains(input));
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
  const fullWidth = shallowRef(false);
  watch(placed, (isPlaced) => {
    const element = positioner.value;
    fullWidth.value =
      isPlaced &&
      !!element &&
      element.offsetWidth >= element.ownerDocument.documentElement.clientWidth - FULL_WIDTH_TOLERANCE;
  });
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
      inside: insideGetters.map((get) => get()).filter((element): element is Element => !!element),
      touchDrag: false,
    };
  });
  const popupFocus = shallowRef<{ initialFocus?: FocusTarget; finalFocus?: FocusTarget }>({});
  const focus = usePopupFocus(root, layer, {
    takesFocus: () => !inputIsControl.value,
    placed: () => placed.value,
    initialFocus: () => popupFocus.value.initialFocus,
    finalFocus: () => popupFocus.value.finalFocus,
    tabIntoPopup: () => inputIsControl.value,
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
    if (source.virtualized) return findItemIndex(filteredValues.value, entry?.value(), isEqual.value);
    return list.items().indexOf(item);
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
    canLeave: () => source.loopFocus && !source.autoHighlight,
    hover: () => source.highlightItemOnHover,
    keepOnLeave: () => source.keepHighlight,
    rows: () => source.grid,
    onHighlight(item, reason, event) {
      // An inline completion shows the text of an item that a key highlights.
      const completes = source.completion === 'both' || source.completion === 'inline';
      completion.value = completes && item && reason === 'keyboard' ? labelOf(valueOf(item)) : null;
      if (item) emitHighlight(valueOf(item), indexOf(item), reason, event);
      else if (!source.virtualized || reason !== 'none') emitHighlight(undefined, -1, reason, event);
    },
  });
  // An item that changes its value gives a new highlight event.
  watch(
    () => (list.highlighted ? valueOf(list.highlighted) : undefined),
    (itemValue) => {
      const item = list.highlighted;
      if (item) emitHighlight(itemValue, indexOf(item), 'none', undefined);
    },
    { flush: 'post' },
  );

  function valueOf(item: ListItem) {
    return itemEntries.get(item.element)?.value();
  }

  function itemOfIndex(index: number) {
    return list.items().find((item) => indexOf(item) === index) ?? null;
  }

  function highlightSelected() {
    const items = list.items();
    const picked =
      lastPick && isSelected(lastPick.value)
        ? items.find((item) => compareItemEquality(valueOf(item), lastPick!.value, isEqual.value))
        : undefined;
    const selected = picked ?? items.find((item) => isSelected(valueOf(item)));
    if (selected) list.highlight(selected, 'none');
    else if (source.virtualized && hasValue.value && source.mode !== 'none') {
      const index = filteredValues.value.findIndex((each) => isSelected(each));
      if (index !== -1) emitHighlight(filteredValues.value[index], index, 'none', undefined);
    }
    return !!selected;
  }

  // The key that opened the popup, for the highlight after the items mounted.
  let openKey: KeyboardEvent | undefined;
  watch(
    () => root.open,
    (open) => {
      typed.value = false;
      completion.value = null;
      const key = openKey;
      openKey = undefined;
      if (!open) {
        list.highlight(null, 'none');
        lastHighlight = { value: undefined, index: -1 };
        resetText();
        return;
      }
      // The items mount in this update.
      void nextTick(() => {
        if (!root.open || list.highlighted) return;
        if (highlightSelected()) return;
        const items = list.items();
        if (source.autoHighlight === 'always') {
          list.highlight(items[0] ?? null, 'none');
        } else if (key && (source.mode !== 'none' || source.autoHighlight)) {
          list.highlight(
            (key.key === 'ArrowUp' ? items.at(-1) : items[0]) ?? null,
            'keyboard',
            key,
          );
        }
      });
    },
  );

  // At a close, the text goes back: the label of the value in an input outside the popup, else
  // no text. Autocomplete keeps its text, which is its value.
  function resetText() {
    if (source.mode === 'none') return;
    const event = new Event('vase-ui');
    if (source.mode === 'single' && inputIsControl.value && !source.inline) {
      const label = labelOf(valueModel.value);
      setText(label, createComboboxDetails(label === '' ? 'input-clear' : 'none', event));
      return;
    }
    if (text.value === '' || (source.inline && source.mode === 'single')) return;
    setText('', createComboboxDetails('input-clear', event, root.reason === 'item-press'));
  }

  // An input in the popup starts with no text: the label of the value is in the trigger.
  onMounted(() => {
    if (followsLabel() && !inputIsControl.value) setOwnText('');
  });

  // The text of a single combobox follows the label of its value.
  watch(
    () => labelOf(valueModel.value),
    (label) => {
      if (followsLabel() && inputIsControl.value && !typed.value && text.value !== label) {
        setText(label, createComboboxDetails('none', new Event('vase-ui')));
      }
    },
  );

  // The field.
  watch(
    [value, hasValue],
    ([current, filled]) => field?.setValue(current, filled),
    { immediate: true },
  );

  // The commands.
  function setText(next: string, details: ComboboxRootChangeEventDetails) {
    if (next === text.value && completion.value === null) return true;
    completion.value = null;
    if (next === text.value) return true;
    emit.text(next, details);
    if (details.isCanceled) return false;
    setOwnText(next);
    emit.updateText(next);
    if (source.mode === 'none') field?.onEdit();
    return true;
  }

  function setValue(next: unknown, details: ComboboxRootChangeEventDetails) {
    emit.value(next, details);
    if (details.isCanceled) return false;
    setOwnValue(next);
    emit.updateValue(next);
    field?.onEdit();
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
      if (link.getAttribute('href')!.startsWith('#')) request(false, 'item-press', pick);
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
      const next = selected ? removeItem(current, itemValue, isEqual.value) : [...current, itemValue];
      if (!setValue(next, details)) return;
      if (!selected) lastPick = { value: itemValue };
      if (text.value.trim() === '') return;
      if (inputIsControl.value && !source.inline) request(false, 'item-press', pick);
      else setText('', createComboboxDetails('input-clear', pick, true));
      return;
    }
    if (!compareItemEquality(itemValue, valueModel.value, isEqual.value) && !setValue(itemValue, details)) {
      return;
    }
    lastPick = { value: itemValue };
    if (inputIsControl.value) setText(labelOf(itemValue), createComboboxDetails('item-press', pick));
    request(false, 'item-press', pick);
  }

  function requestSubmit() {
    const form = textInput.value?.form ?? (controlInput.value as HTMLInputElement | null)?.form;
    form?.requestSubmit();
  }

  function onTyped(typedText: string, event: Event) {
    typed.value = true;
    completion.value = null;
    list.highlight(null, 'none', event);
    // Each typed text shows the list from its top.
    const first = list.items()[0]?.element ?? listElement.value;
    if (!source.virtualized && first) resetScroll(first);
    const hasText = typedText.trim() !== '';
    if (hasText && !disabled.value && !source.readonly) request(true, 'input-change', event);
    void nextTick(() => {
      if (!expanded.value) return;
      if (hasText ? !!source.autoHighlight : source.autoHighlight === 'always') {
        list.highlight(list.items()[0] ?? null, 'none');
      } else if (!hasText) {
        highlightSelected();
      }
    });
  }

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

  function onListKeydown(event: KeyboardEvent) {
    if (!source.virtualized) return list.onKeydown(event);
    if (event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return false;
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return false;
    event.preventDefault();
    // A virtual window has the items of only some values, so the keys count on the values.
    const count = filteredValues.value.length;
    const current = lastHighlight.index;
    let next = current === -1 ? (step === 1 ? 0 : count - 1) : current + step;
    if (next < 0 || next >= count) {
      if (source.loopFocus && !source.autoHighlight) next = -1;
      else if (source.loopFocus) next = (next + count) % count;
      else next = current;
    }
    emitHighlight(next === -1 ? undefined : filteredValues.value[next], next, 'keyboard', event);
    list.highlight(next === -1 ? null : itemOfIndex(next), 'keyboard', event);
    return true;
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

  let stopDrag: (() => void) | undefined;
  onScopeDispose(() => stopDrag?.());
  function startDrag(press: PointerEvent) {
    stopDrag?.();
    const doc = ownerDocument(press.target as Element);
    const end = (release: PointerEvent) => {
      stopDrag?.();
      if (release.type !== 'pointerup' || !root.open || isReleaseAtPressPoint(press, release)) {
        return;
      }
      const target = release.target as Element;
      const item = list.items().find(({ element }) => element.contains(target));
      if (item) {
        if (!item.disabled) dispatchClickWithModifiers(item.element, release, { detail: 1, pointerType: 'mouse' });
        return;
      }
      if (isInPopup(layer, target) || triggerElement.value?.contains(target)) return;
      if (layer.inside.some((element) => element.contains(target))) return;
      request(false, 'cancel-open', release);
    };
    const stopUp = addEventListener(doc, 'pointerup', end, true);
    const stopCancel = addEventListener(doc, 'pointercancel', end, true);
    stopDrag = () => {
      stopUp();
      stopCancel();
      stopDrag = undefined;
    };
  }

  function add<T>(collection: T[], item: T) {
    collection.push(item);
    return () => {
      const index = collection.indexOf(item);
      if (index !== -1) collection.splice(index, 1);
    };
  }

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
    get virtualized() {
      return source.virtualized;
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
    get hasValue() {
      return hasValue.value;
    },
    get data() {
      return data.value;
    },
    get filteredItems() {
      return filteredItems.value;
    },
    get filteredValues() {
      return filteredValues.value;
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
      return lists.at(-1)?.element ? lists.at(-1)!.id : undefined;
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
    valueOf,
    request,
    setText,
    setValue,
    select,
    onTyped,
    onListKeydown,
    clickHighlighted,
    openByKey,
    startDrag,
    requestSubmit,
    addInput: (input) => add(inputs, input),
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
        const listItem = list.items().find((each) => each.element === element);
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
    rendersInputs: () =>
      source.mode !== 'none' || (mounted.value && !inputIsControl.value),
    formElement,
    isEqual: () => isEqual.value,
    reset() {
      const firstOwn = valueModelOf(source.defaultValue ?? null) ?? (multiple() ? NO_VALUES : null);
      if (source.value === undefined && source.mode !== 'none' && isSelectedValueDirty(valueModel.value, firstOwn, isEqual.value)) {
        setOwnValue(firstOwn);
        emit.updateValue(firstOwn);
      }
      const resetText =
        source.defaultText ?? (source.mode === 'single' && inputIsControl.value ? labelOf(firstOwn) : '');
      if (source.text === undefined && text.value !== resetText) {
        setOwnText(resetText);
        emit.updateText(resetText);
      }
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

function missingRoot(family: string, part: string): never {
  throw new Error(
    `Vase UI: <${family}.${part}> must be inside <${family}.Root>. Without a root the part has no combobox. Put the part inside <${family}.Root>.`,
  );
}

/** The root of the part. A part with no root throws an error that names it. */
export function injectComboboxRoot(part: string) {
  const context = inject(comboboxKey, null);
  return context ?? missingRoot('Combobox', part);
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
    throw new Error(
      `Vase UI: <${context.family}.${part}> must be inside <${context.family}.Portal>. Put the part inside <${context.family}.Portal>.`,
    );
  }
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(context: ComboboxRootContext, part: string) {
  const placement = inject(positionerKey, null);
  if (!placement) {
    throw new Error(
      `Vase UI: <${context.family}.${part}> must be inside <${context.family}.Positioner>. Put the part inside <${context.family}.Positioner>.`,
    );
  }
  return placement;
}

/** The part is in a popup: its positioner is around it. */
export function useInPopup() {
  return !!inject(positionerKey, null);
}


/** What `Chips` gives to its chips and to the input in it. */
export interface ChipsContext {
  /** The direction of the chips element is right to left. */
  rtl(): boolean;
  /** Moves the focus to the chip at the index. -1 is the last chip. */
  focusChip(index: number): void;
  addChip(element: HTMLElement): () => void;
  /** The place of the chip among the chips, which is the place of its value. */
  indexOf(element: HTMLElement): number;
}

export const chipsKey: InjectionKey<ChipsContext> = Symbol('combobox chips');

/** What a `Chip` gives to its `ChipRemove`. */
export interface ChipContext {
  readonly element: HTMLElement | null;
  readonly disabled: boolean;
}

export const chipKey: InjectionKey<ChipContext> = Symbol('combobox chip');

export function injectChips() {
  return inject(chipsKey, null);
}

/** An item in a `Row` is a cell of a grid. */
export const rowKey: InjectionKey<boolean> = Symbol('combobox row');

/** What a `Group` gives to its label. */
export const groupKey: InjectionKey<{ addLabel(label: { readonly id: string }): () => void }> =
  Symbol('combobox group');

/**
 * The items that the filter of the root keeps, in the form of `items`. Call it in the `setup` of a
 * component in the root. Read the list only: the root can share it.
 */
export function useFilteredItems<T>(): ComputedRef<T[]> {
  const context = inject(comboboxKey, null);
  if (!context) {
    throw new Error(
      'Vase UI: useFilteredItems() must be called in a component inside a root of Combobox or Autocomplete. Without a root there are no items. Call it in a component inside the root.',
    );
  }
  return computed(() => context.filteredItems as T[]);
}
