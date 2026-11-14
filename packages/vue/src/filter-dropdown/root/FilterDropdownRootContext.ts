import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { FilterDropdownStore } from '../store';

export interface FilterDropdownItemRegistration {
  getText: () => string | undefined;
}

export type FilterDropdownFilter = (text: string, query: string) => boolean;

export interface FilterDropdownRootContext {
  open: ComputedRef<boolean>;
  disabled: ComputedRef<boolean>;
  inputFocusVisible: Readonly<Ref<boolean>>;
  setInputFocusVisible: (visible: boolean) => void;
  keyboardModality: Readonly<Ref<boolean>>;
  setKeyboardModality: (keyboardModality: boolean) => void;
  autoHighlight: ComputedRef<boolean | 'always'>;
  triggerId: ComputedRef<string | undefined>;
  defaultListId: ComputedRef<string>;
  listId: ComputedRef<string | undefined>;
  /** Records the id the list rendered with, when it differs from `defaultListId`. */
  setRenderedListId: (id: string | undefined) => void;
  /** The input, which owns real focus while the host uses virtual list navigation. */
  focusOwnerRef: Ref<HTMLElement | null>;
  /** Moves the host's highlight. */
  setActiveIndex: (index: number | null) => void;
  /** Called with the previous items when the host's list changes after it first registered. */
  onItemsChange: (previousItems: readonly (HTMLElement | null)[]) => void;
  /** Reports a query edit and resets the highlight it invalidates. */
  onValueChange: (value: string, eventDetails: FilterDropdownRootChangeEventDetails) => void;
}

export interface FilterDropdownItemContext {
  /** The enclosing dropdown when this root is nested. */
  parent: FilterDropdownItemContext | null;
  store: FilterDropdownStore;
  registerItem: (id: symbol, registration: FilterDropdownItemRegistration) => () => void;
  listRef: Readonly<Ref<ReadonlyArray<HTMLElement | null>>>;
}

function throwMissingFilterRoot(): never {
  throw new Error(
    'Vase UI: A filter part is outside the filter context of its component. Without that context the part has no query and no items. Put the root of the component inside its filter provider.',
  );
}

export const FilterDropdownItemContext: InjectionKey<FilterDropdownItemContext> = Symbol();

export function useFilterDropdownItemContext(optional?: false): FilterDropdownItemContext;
export function useFilterDropdownItemContext(optional: true): FilterDropdownItemContext | null;
export function useFilterDropdownItemContext(optional: boolean): FilterDropdownItemContext | null;
export function useFilterDropdownItemContext(optional = false) {
  const context = inject(FilterDropdownItemContext, null);
  if (context === null && !optional) {
    throwMissingFilterRoot();
  }
  return context;
}

export const FilterDropdownRootContext: InjectionKey<FilterDropdownRootContext> = Symbol();

export function useFilterDropdownRootContext(optional?: false): FilterDropdownRootContext;
export function useFilterDropdownRootContext(optional: true): FilterDropdownRootContext | null;
export function useFilterDropdownRootContext(optional: boolean): FilterDropdownRootContext | null;
export function useFilterDropdownRootContext(optional = false) {
  const context = inject(FilterDropdownRootContext, null);
  if (context === null && !optional) {
    throwMissingFilterRoot();
  }
  return context;
}

/**
 * Finds the dropdown that owns the given item list, walking out through nested roots.
 */
export function useFilterContextForList(
  listRef: Readonly<Ref<ReadonlyArray<HTMLElement | null>>> | null,
) {
  let context = inject(FilterDropdownItemContext, null);
  if (listRef === null) {
    return null;
  }

  while (context !== null && context.listRef !== listRef) {
    context = context.parent;
  }
  return context;
}

export const FilterDropdownValueContext: InjectionKey<ComputedRef<string>> = Symbol();

// All apps and all server requests share this value, so it holds no state.
const DEFAULT_FILTER_DROPDOWN_VALUE = computed(() => '');

export function useFilterDropdownValueContext(): ComputedRef<string> {
  return inject(FilterDropdownValueContext, DEFAULT_FILTER_DROPDOWN_VALUE);
}

export type FilterDropdownRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.clearPress
  | typeof REASONS.popupClose;

export type FilterDropdownRootChangeEventDetails =
  VaseUIChangeEventDetails<FilterDropdownRootChangeEventReason>;
