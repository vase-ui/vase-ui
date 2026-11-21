import {
  computed,
  inject,
  nextTick,
  provide,
  shallowReactive,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useModel } from '../common/model';
import type { FieldForControl } from '../field/control';
import { compareItemEquality, defaultItemEquality, removeItem } from '../common/itemEquality';
import { stringifyAsValue } from '../common/resolveValueLabel';
import { useList, type List, type ListItem } from '../list/list';
import { useTypeahead } from '../list/typeahead';
import { usePopupFocus, type FocusTarget } from '../popup/focus';
import { isInPopup, useLayer, type Layer } from '../popup/layer';
import type { Align, Side, usePlacement } from '../popup/placement';
import { usePopupPress } from '../popup/press';
import { usePopupRoot, type PopupRoot } from '../popup/root';
import type {
  SelectItems,
  SelectRootChangeEventDetails,
  SelectRootChangeEventReason,
  SelectRootOpenChangeEventDetails,
  SelectRootProps,
} from './types';

/** What `Select.Root` gives to its parts. The properties are reactive. */
export interface SelectContext {
  readonly root: PopupRoot;
  readonly layer: Layer;
  readonly list: List;
  readonly typeahead: ReturnType<typeof useTypeahead>;
  readonly focus: ReturnType<typeof usePopupFocus>;
  readonly press: ReturnType<typeof usePopupPress>;
  readonly field: FieldForControl | null;
  /** The value: an array with `multiple`. */
  readonly value: unknown;
  readonly multiple: boolean;
  /** Disabled by the root, its field or a fieldset. */
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly modal: boolean;
  readonly highlightItemOnHover: boolean;
  /** The value is not `null`, not an empty array, and has a form text. */
  readonly hasValue: boolean;
  readonly items: SelectItems;
  readonly itemToStringLabel: ((value: any) => string) | undefined;
  /** The `id` of a trigger with no `id` prop. */
  readonly triggerId: string;
  /** The `id` of the first `Select.Label`. */
  readonly labelId: string | undefined;
  /** The content of the popup stays in the DOM. */
  readonly kept: boolean;
  /** The key that opened the popup, for its first focus. */
  openKey: string | undefined;
  /** The value of each item, by its element. */
  readonly itemValues: Map<Element, unknown>;
  /** The `Select.ItemText` of each item, by the element of the item. */
  readonly itemTexts: Map<Element, HTMLElement>;
  readonly valueElement: ShallowRef<HTMLElement | null>;
  readonly listElement: ShallowRef<HTMLElement | null>;
  readonly positioner: ShallowRef<HTMLElement | null>;
  /** The positioner has its place for this open. */
  readonly placed: ShallowRef<boolean>;
  /** The popup covers the trigger for this open. */
  readonly aligned: ShallowRef<boolean>;
  /** The side of the trigger that the popup is on, while a positioner is mounted. */
  readonly side: ShallowRef<Side | 'none' | null>;
  /** The popup element shows. */
  readonly popupShown: ShallowRef<boolean>;
  /** The `id` of the mounted popup, and of the mounted `Select.List`, for `aria-controls`. */
  readonly popupId: ShallowRef<string | undefined>;
  readonly listId: ShallowRef<string | undefined>;
  /** The list can scroll up and down. */
  readonly scrollable: ShallowRef<{ up: boolean; down: boolean }>;
  /** The number of mounted scroll arrows. */
  readonly arrows: ShallowRef<number>;
  readonly finalFocus: ShallowRef<FocusTarget | undefined>;
  /** The element that scrolls and takes the focus with no highlight: the list, else the popup. */
  container(): HTMLElement | null;
  isSelected(value: unknown): boolean;
  /** The user pressed an item with this value. */
  select(value: unknown, event: Event): void;
  /** Sets the value after an action of the user. Returns `false` when a listener cancelled. */
  change(value: unknown, reason: SelectRootChangeEventReason, event: Event): boolean;
  /** The content stays in the DOM from now on. */
  keep(): void;
  addLabel(label: { readonly id: string }): () => void;
  /** The first item of the value, in the order of the document, shown or not. */
  selectedItem(): ListItem | undefined;
}

const selectKey: InjectionKey<SelectContext> = Symbol('select root');
const NO_VALUES: readonly unknown[] = Object.freeze([]);

// A touch open locks the page only when the popup covers the view (as Popover).
const FULL_WIDTH_TOLERANCE = 20;

export function useSelectRoot(
  props: Required<
    Pick<
      SelectRootProps,
      'defaultOpen' | 'modal' | 'highlightItemOnHover' | 'required' | 'readonly' | 'disabled'
    >
  > &
    SelectRootProps<any, boolean | undefined>,
  options: {
    field: FieldForControl | null;
    triggerId: () => string;
    disabled: () => boolean;
  },
  emit: {
    (event: 'valueChange', value: any, details: SelectRootChangeEventDetails): void;
    (event: 'update:modelValue', value: any): void;
    (event: 'openChange', open: boolean, details: SelectRootOpenChangeEventDetails): void;
    (event: 'update:open', open: boolean): void;
  },
) {
  const { field } = options;
  const multiple = computed(() => !!props.multiple);
  const model = () => (props.modelValue === null && multiple.value ? NO_VALUES : props.modelValue);
  const noValue = () => (multiple.value ? NO_VALUES : null);
  const firstModel = model();
  /** The value of the mount, which an item that leaves gives back. */
  const firstValue = firstModel === undefined ? (props.defaultValue ?? noValue()) : firstModel;
  const valueModel = useModel<unknown>(model, firstValue);
  const { value } = valueModel;
  const comparer = (itemValue: unknown, current: unknown) =>
    props.isItemEqualToValue
      ? props.isItemEqualToValue(itemValue, current)
      : defaultItemEquality(itemValue, current);
  const equal = (a: unknown, b: unknown) => compareItemEquality(a, b, comparer);
  const values = computed(() => (Array.isArray(value.value) ? value.value : NO_VALUES));
  const hasValue = computed(() =>
    multiple.value
      ? values.value.length > 0
      : value.value != null && stringifyAsValue(value.value, props.itemToStringValue) !== '',
  );

  const root = usePopupRoot({
    name: 'Select',
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    triggerId: () => undefined,
    defaultTriggerId: null,
    handle: () => undefined,
    emitChange: (open, details) => {
      emit('openChange', open, details as SelectRootOpenChangeEventDetails);
      if (details.isCanceled || open) return;
      if (details.reason === 'focus-out' || details.reason === 'outside-press') {
        const trigger = root.activeTrigger;
        if (trigger) field?.onLeave(trigger);
      }
    },
    emitOpen: (open) => emit('update:open', open),
    emitTriggerId: () => {},
  });

  const kept = shallowRef(false);
  watch(
    () => root.open,
    (open) => {
      if (open) kept.value = true;
    },
    { immediate: true, flush: 'sync' },
  );

  const positioner = shallowRef<HTMLElement | null>(null);
  const listElement = shallowRef<HTMLElement | null>(null);
  const valueElement = shallowRef<HTMLElement | null>(null);
  const placed = shallowRef(false);
  const aligned = shallowRef(false);
  const side = shallowRef<Side | 'none' | null>(null);
  const popupShown = shallowRef(false);
  const popupId = shallowRef<string>();
  const listId = shallowRef<string>();
  const scrollable = shallowRef({ up: false, down: false });
  const arrows = shallowRef(0);
  const finalFocus = shallowRef<FocusTarget>();
  const itemValues = shallowReactive(new Map<Element, unknown>());
  const itemTexts = shallowReactive(new Map<Element, HTMLElement>());
  const labels = shallowReactive<{ readonly id: string }[]>([]);
  const container = () => listElement.value ?? root.popup;

  const fullWidth = computed(() => {
    const element = positioner.value;
    return (
      placed.value &&
      !!element &&
      element.offsetWidth >=
        element.ownerDocument.documentElement.clientWidth - FULL_WIDTH_TOLERANCE
    );
  });
  const layer = useLayer(root, () => ({
    escape: true,
    outsidePress: true,
    focusOut: true,
    pressStart: true,
    block: props.modal && !!positioner.value,
    hide: false,
    trap: false,
    lockScroll: (props.modal || aligned.value) && (root.interaction !== 'touch' || fullWidth.value),
    triggerInUse: true,
    tapEnd: true,
  }));

  const list = useList({
    orientation: () => 'vertical',
    loop: () => false,
    container,
    hover: () => props.highlightItemOnHover,
  });

  const selectedItem = () =>
    list.items({ hidden: true }).find((item) => isSelected(itemValues.get(item.element)));

  function isSelected(itemValue: unknown) {
    return multiple.value
      ? values.value.some((each) => equal(itemValue, each))
      : equal(itemValue, value.value);
  }

  let openKey: string | undefined;
  const focus = usePopupFocus(root, layer, {
    takesFocus: () => true,
    placed: () => placed.value,
    // The highlight is set again at each open, so a leave shows no change of it.
    initialFocus: () => {
      const reachable = list.items();
      let target = reachable.find((item) => isSelected(itemValues.get(item.element)));
      if (!target && root.interaction === 'keyboard') {
        target = openKey === 'ArrowUp' ? reachable.at(-1) : reachable[0];
      } else if (!target && aligned.value && props.highlightItemOnHover) {
        target = reachable[0];
      }
      openKey = undefined;
      list.highlight(target ?? null, 'none');
      return target ? false : container();
    },
    finalFocus: () => finalFocus.value,
    closeBefore: true,
    lostFocus: container,
  });

  const typeahead = useTypeahead(list, {
    resetMs: 750,
    skipDisabled: true,
    current: () => (root.open ? list.highlighted : (selectedItem() ?? null)),
    onMatch(item, event) {
      const itemValue = itemValues.get(item.element);
      if (root.open) list.highlight(item, 'keyboard');
      else if (!equal(itemValue, value.value)) change(itemValue, 'none', event);
    },
    get hidden() {
      return !root.open;
    },
  });

  const press = usePopupPress(root, {
    itemAt(path) {
      const item = list.items().find((each) => path.includes(each.element));
      return item && !item.disabled ? item.element : null;
    },
    inside: (target) => isInPopup(layer, target),
    earlyRelease: (element) => !isSelected(itemValues.get(element)),
    triggerMargin: 5,
    laterPress: true,
  });

  function change(next: unknown, reason: SelectRootChangeEventReason, event: Event, byUser = true) {
    const details = createChangeEventDetails(reason, event);
    emit('valueChange', next, details);
    if (details.isCanceled) return false;
    valueModel.setOwn(next);
    emit('update:modelValue', next);
    // A controlled root shows the value that the parent gives in its next render.
    if (byUser) void nextTick(() => field?.onEdit());
    return true;
  }

  function select(itemValue: unknown, event: Event) {
    if (!options.disabled() && !props.readonly) {
      if (multiple.value) {
        const next = isSelected(itemValue)
          ? removeItem(values.value, itemValue, (a, b) => equal(a, b))
          : [...values.value, itemValue];
        change(next, 'item-press', event);
        return;
      }
      // A native select sends no `change` for the option that it has.
      if (!equal(itemValue, value.value)) change(itemValue, 'item-press', event);
    }
    if (!multiple.value) root.request(false, 'item-press', event);
  }

  // An item that leaves changes the value, as an option of a native select that leaves. A list that
  // mounts for the first time changes nothing. The user did not edit the value, so the field keeps
  // its errors.
  let listMounted = false;
  watch(
    () => list.items({ hidden: true }).map((item) => itemValues.get(item.element)),
    (present) => {
      if (!listMounted) {
        listMounted = present.length > 0;
        return;
      }
      const has = (each: unknown) => present.some((itemValue) => equal(itemValue, each));
      const event = new Event('vase-ui');
      if (multiple.value) {
        const next = values.value.filter(has);
        if (next.length !== values.value.length) change(next, 'none', event, false);
      } else if (value.value != null && !has(value.value)) {
        change(firstValue != null && has(firstValue) ? firstValue : null, 'none', event, false);
      }
    },
    { flush: 'post' },
  );

  watch([value, hasValue], ([current, filled]) => field?.setValue(current, filled), {
    immediate: true,
  });

  const context: SelectContext = {
    root,
    layer,
    list,
    typeahead,
    focus,
    press,
    field,
    get value() {
      return multiple.value ? values.value : value.value;
    },
    get multiple() {
      return multiple.value;
    },
    get disabled() {
      return options.disabled();
    },
    get readonly() {
      return props.readonly;
    },
    get required() {
      return props.required;
    },
    get modal() {
      return props.modal;
    },
    get highlightItemOnHover() {
      return props.highlightItemOnHover;
    },
    get hasValue() {
      return hasValue.value;
    },
    get items() {
      return props.items;
    },
    get itemToStringLabel() {
      return props.itemToStringLabel;
    },
    get triggerId() {
      return options.triggerId();
    },
    get labelId() {
      return labels[0]?.id;
    },
    get kept() {
      return kept.value;
    },
    get openKey() {
      return openKey;
    },
    set openKey(key) {
      openKey = key;
    },
    itemValues,
    itemTexts,
    valueElement,
    listElement,
    positioner,
    placed,
    aligned,
    side,
    popupShown,
    popupId,
    listId,
    scrollable,
    arrows,
    finalFocus,
    container,
    isSelected,
    select,
    change,
    keep() {
      kept.value = true;
    },
    addLabel(label) {
      labels.push(label);
      return () => labels.splice(labels.indexOf(label), 1);
    },
    selectedItem,
  };
  provide(selectKey, context);

  return {
    context,
    value,
    hasValue,
    setOwn: (next: unknown) => valueModel.setOwn(next),
    /** The value that a native reset gives. */
    resetValue: () => valueModel.resetValue(props.defaultValue ?? noValue()),
    /** Asks for a close with the reason `'imperative-action'`. */
    close() {
      root.request(false, 'imperative-action', new Event('vase-ui'));
    },
  };
}

/** The root of the part. A part with no root throws an error that names it. */
export function injectSelectRoot(part: string) {
  const context = inject(selectKey, null);
  if (!context) {
    throw new Error(
      `Vase UI: <Select.${part}> must be inside <Select.Root>. Without a root the part has no value and no popup. Put the part inside <Select.Root>.`,
    );
  }
  return context;
}

/** What `Select.Positioner` gives to the parts in it. The properties are reactive. */
export interface SelectPositionerContext {
  readonly side: Readonly<Ref<Side | 'none'>>;
  readonly align: Readonly<Ref<Align>>;
  readonly arrow: ReturnType<typeof usePlacement>['arrow'];
  /** The list scrolled: an aligned popup grows, and the scroll arrows show or hide. */
  onScroll(scroller: HTMLElement): void;
}

export const selectPositionerKey: InjectionKey<SelectPositionerContext> =
  Symbol('select positioner');
const portalKey: InjectionKey<true> = Symbol('select portal');

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectSelectPositioner(part: string) {
  const placement = inject(selectPositionerKey, null);
  if (!placement) {
    throw new Error(
      `Vase UI: <Select.${part}> must be inside <Select.Positioner>. Put the part inside <Select.Positioner>.`,
    );
  }
  return placement;
}

/** Marks the parts in a `Select.Portal`. */
export function providePortal() {
  provide(portalKey, true);
}

/** `Select.Positioner` and `Select.Backdrop` need a portal of their root. */
export function injectPortal(part: string) {
  if (!inject(portalKey, false)) {
    throw new Error(
      `Vase UI: <Select.${part}> must be inside <Select.Portal>. Put the part inside <Select.Portal>.`,
    );
  }
}

/** The element of the `Select.Item` around a part. */
export const selectItemKey: InjectionKey<Readonly<Ref<HTMLElement | null>>> = Symbol('select item');

/** What `Select.Group` gives to its label. */
export const selectGroupKey: InjectionKey<{
  addLabel(label: { readonly id: string }): () => void;
}> = Symbol('select group');
