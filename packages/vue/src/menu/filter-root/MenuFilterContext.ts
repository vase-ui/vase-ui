import { computed, inject } from 'vue';
import type { Component, ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue';
import { NOOP } from '../../common/empty';
import type {
  UseFilterDropdownItemParameters,
  UseFilterDropdownItemReturnValue,
} from '../../filter-dropdown/item/useFilterDropdownItem';
import type { UseRenderElementParameters } from '../../internals/useRenderElement';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager.vue';
import { useMenuRootContext } from '../root/MenuRootContext';

export interface MenuFilterPopup {
  /**
   * Merges the attributes and the listeners that the popup of a filterable menu adds with the
   * attributes of the consumer.
   */
  props: (attrs: Record<string, any>) => Record<string, any>;
  /** The element that gets the focus when the popup opens. */
  initialFocus: ComputedRef<FocusOption>;
}

export interface MenuFilterList {
  /** The props of the list element. The attributes of the consumer come last. */
  props: NonNullable<UseRenderElementParameters<object>['props']>;
}

export interface MenuFilterGroup {
  /** The props of the group element while the query hides each item of the group. */
  hiddenProps: ComputedRef<Record<string, any> | undefined>;
}

export interface MenuFilterListParameters {
  /** The `id` of the list. The id that the filter root generates when `undefined`. */
  id: MaybeRefOrGetter<string | undefined>;
}

export interface MenuFilterItem extends UseFilterDropdownItemReturnValue {
  /** Renders nothing and reads the text of the default slot of an item that the query hides. */
  HiddenItemText: Component | undefined;
}

/**
 * The filter implementation that a filterable root gives to the parts below it. Only the root that
 * `Menu.FilterProvider` renders imports it, so a plain menu never bundles it. A part that a
 * filterable menu changes calls one function of this object, and merges the result into its own
 * props.
 */
export interface MenuFilterImpl {
  /** Gives the popup its dialog role, its listeners and its initial focus. */
  usePopup: () => MenuFilterPopup;
  /** Gives the list its menu role, its key handler and its id. */
  useList: (params: MenuFilterListParameters) => MenuFilterList;
  /** Hides the group once the query filters out all of its items. */
  useGroup: () => MenuFilterGroup;
  /** Registers an item with the filter and reports whether it matches the query. */
  useItem: (params: UseFilterDropdownItemParameters) => UseFilterDropdownItemReturnValue;
  /** The component that an item renders in place of its element while the query hides it. */
  HiddenItemText: Component;
}

/** Static below a filter root: the implementation never changes. */
export const MenuFilterImplContext: InjectionKey<MenuFilterImpl | null> = Symbol();

/**
 * The filter implementation when the menu this part belongs to is filterable, otherwise `null`.
 * `virtualFocus` marks a filter root; a plain `Menu.Root` never sets it. The result is fixed for
 * a mounted part, because a filter root cannot appear above it without a new mount.
 */
export function useMenuFilterImpl(): MenuFilterImpl | null {
  // The default `null` stops the Vue warning for a missing provider.
  const impl = inject(MenuFilterImplContext, null);
  const root = useMenuRootContext(true);

  if (impl === null || root === undefined) {
    return null;
  }

  return root.virtualFocus ? impl : null;
}

/**
 * Throws unless the menu this part renders in is filterable, naming the part and the provider.
 */
export function useMenuFilterPart(part: string) {
  if (useMenuFilterImpl() === null) {
    throw new Error(
      `Vase UI: <Menu.${part}> must be placed in a menu wrapped in <Menu.FilterProvider>. ` +
        'It reads the filter query and the matching items from the provider, which a plain menu ' +
        'does not have. Wrap the <Menu.Root> or <Menu.SubmenuRoot> of the part in ' +
        '<Menu.FilterProvider>.',
    );
  }
}

// All apps and all server requests share this object, so it holds no state.
const UNFILTERED: MenuFilterItem = {
  visible: computed(() => true),
  ref: NOOP,
  setHiddenText: NOOP,
  HiddenItemText: undefined,
};

/**
 * Registers an item part with the filter of the menu it belongs to. The items of a plain menu are
 * always visible. Call it in `setup`.
 */
export function useMenuFilterItem(params: UseFilterDropdownItemParameters): MenuFilterItem {
  const impl = useMenuFilterImpl();
  if (impl === null) {
    return UNFILTERED;
  }

  return { ...impl.useItem(params), HiddenItemText: impl.HiddenItemText };
}
