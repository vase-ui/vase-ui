import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
} from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';
import type { Filter, GetFilterParameters } from '../common/filter';
import type { FocusTarget } from '../popup/focus';
import type { Align, PlacementProps, Side } from '../popup/placement';
import type { PopupPortalProps } from '../popup/portal';
import type { InteractionType, PopupChangeEventDetails } from '../popup/root';
import type { SeparatorProps, SeparatorState } from '../separator/types';
import type { MenuHandle } from './root';

export type {
  Align,
  Anchor,
  Boundary,
  CollisionAvoidance,
  OffsetFunction,
  Side,
  VirtualElement,
} from '../popup/placement';
export type { FocusTarget, InteractionType };

export type MenuRootOrientation = 'horizontal' | 'vertical';

export type MenuRootChangeEventReason =
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'outside-press'
  | 'focus-out'
  | 'list-navigation'
  | 'escape-key'
  | 'item-press'
  | 'close-press'
  | 'sibling-open'
  | 'cancel-open'
  | 'imperative-action'
  | 'none';

export type MenuRootChangeEventDetails = PopupChangeEventDetails<MenuRootChangeEventReason>;

export type MenuRootHighlightEventReason = 'keyboard' | 'pointer' | 'none';

export interface MenuRootHighlightEventDetails {
  reason: MenuRootHighlightEventReason;
  /** The event of the user that moved the highlight, if one did. */
  event: Event | undefined;
  /** The `label` of the highlighted item, else its text. */
  label: string | undefined;
}

/** The props that a root, a submenu root and a context menu root have. */
interface MenuRootCommonProps {
  /** The menu is open. `v-model:open` binds it. */
  open?: boolean | undefined;
  /**
   * The menu is open at the mount of an uncontrolled root.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * The user cannot open the menu or use its items.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The axis of the arrow keys that move the highlight.
   * @default 'vertical'
   */
  orientation?: MenuRootOrientation | undefined;
  /**
   * An arrow key at the last item goes to the first item, and the other way.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * A move of the pointer highlights its item. With `false`, CSS `:hover` and
   * `[data-highlighted]` differ.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
}

export interface MenuRootProps<Payload = unknown> extends MenuRootCommonProps {
  /** The `id` of the active trigger. `v-model:trigger-id` binds it. */
  triggerId?: string | null | undefined;
  /**
   * The `id` of the active trigger at the mount, with `defaultOpen`.
   * @default null
   */
  defaultTriggerId?: string | null | undefined;
  /** Connects the root to triggers outside it and to code. */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * The page does not scroll and gets no pointer while the menu is open. A menu that a hover
   * opened is not modal until a press on its trigger. After a touch, the page scrolls unless the
   * popup covers the width of the view.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Escape in a submenu also closes its parent menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
}

export interface MenuRootState {}

export interface MenuSubmenuRootProps extends MenuRootCommonProps {
  /**
   * Escape in the submenu also closes its parent menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
}

export interface MenuSubmenuRootState {}

export type MenuSubmenuRootChangeEventReason = MenuRootChangeEventReason;

export type MenuSubmenuRootChangeEventDetails = MenuRootChangeEventDetails;

export interface MenuTriggerProps<Payload = unknown>
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  id?: string | undefined;
  /**
   * The user cannot press the trigger.
   * @default false
   */
  disabled?: boolean | undefined;
  /** The payload that the menu gets when this trigger opens it. */
  payload?: Payload | undefined;
  /** Connects the trigger to a root outside it. */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * A mouse that rests on the trigger also opens the menu. In a menubar, `false` also stops the
   * open by a hover while another menu of the bar is open.
   */
  openOnHover?: boolean | undefined;
  /**
   * The time in milliseconds that the mouse rests on the trigger before the open, with
   * `openOnHover`.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * The time in milliseconds before the close, after the pointer left the trigger and the popup,
   * with `openOnHover`.
   * @default 0
   */
  closeDelay?: number | undefined;
}

export interface MenuTriggerState {
  /** The menu is open for this trigger. */
  open: boolean;
  disabled: boolean;
}

export interface MenuPortalProps extends PopupPortalProps {}

export interface MenuPortalState {}

export interface MenuBackdropProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MenuBackdropState {
  open: boolean;
}

export interface MenuPositionerProps
  extends AsProps, PlacementProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MenuPositionerState {
  open: boolean;
  /** The side of the anchor that the popup is on. */
  side: Side;
  align: Align;
  /** The anchor is out of view. */
  anchorHidden: boolean;
  /** The menu is a submenu. */
  nested: boolean;
  instant: string | undefined;
}

export interface MenuPopupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
  /**
   * The element that gets the focus at the close. By default: the trigger, else the element that
   * had the focus before the open.
   */
  finalFocus?: FocusTarget | undefined;
}

export interface MenuPopupState {
  open: boolean;
  side: Side;
  align: Align;
  /** The menu is a submenu. */
  nested: boolean;
  /**
   * Why a style should skip its animation: `'click'` (a key on the trigger), `'dismiss'` (Escape),
   * `'group'` (a move between the menus of a menubar), `'trigger-change'` (a move to another
   * trigger).
   */
  instant: string | undefined;
}

export interface MenuArrowProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MenuArrowState {
  open: boolean;
  side: Side;
  align: Align;
  /** The arrow cannot point to the center of the anchor. */
  uncentered: boolean;
}

export interface MenuViewportProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MenuViewportState {
  /** The side of the new trigger from the old one, such as `'right down'`. */
  activationDirection: string | undefined;
  /** The popup moves to another trigger. */
  transitioning: boolean;
  instant: string | undefined;
}

/** The props of each item. */
interface MenuItemCommonProps {
  id?: string | undefined;
  /** The text that the typeahead and the filter read. With no value, the text of the item. */
  label?: string | undefined;
}

export interface MenuItemProps
  extends MenuItemCommonProps, AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /**
   * The item keeps the focus, and does no action.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A click closes the menu.
   * @default true
   */
  closeOnClick?: boolean | undefined;
}

export interface MenuItemState {
  disabled: boolean;
  highlighted: boolean;
}

export interface MenuLinkItemProps
  extends MenuItemCommonProps, AsProps, /* @vue-ignore */ Omit<AnchorHTMLAttributes, 'as' | 'id'> {
  /**
   * A click closes the menu.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export interface MenuLinkItemState {
  highlighted: boolean;
}

export type MenuCheckboxItemChangeEventReason = 'item-press';

export type MenuCheckboxItemChangeEventDetails =
  ChangeEventDetails<MenuCheckboxItemChangeEventReason>;

export interface MenuCheckboxItemProps
  extends MenuItemCommonProps, AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The item is checked. `v-model` binds it. */
  modelValue?: boolean | undefined;
  /**
   * The item is checked at the mount of an uncontrolled item.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * The item keeps the focus, and the user cannot change it.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A click closes the menu.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export interface MenuCheckboxItemState {
  checked: boolean;
  disabled: boolean;
  highlighted: boolean;
}

export type MenuRadioGroupChangeEventReason = 'item-press';

export type MenuRadioGroupChangeEventDetails = ChangeEventDetails<MenuRadioGroupChangeEventReason>;

export interface MenuRadioGroupProps<Value = unknown>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The value of the checked item. `v-model` binds it. */
  modelValue?: Value | undefined;
  /** The value of the checked item at the mount of an uncontrolled group. */
  defaultValue?: Value | undefined;
  /**
   * The user cannot change the value.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface MenuRadioGroupState {
  disabled: boolean;
}

export interface MenuRadioItemProps<Value = unknown>
  extends MenuItemCommonProps, AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The value that the group gets at a press of the item. */
  value: Value;
  /**
   * The item keeps the focus, and the user cannot choose it.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A click closes the menu.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export interface MenuRadioItemState {
  checked: boolean;
  disabled: boolean;
  highlighted: boolean;
}

export interface MenuSubmenuTriggerProps
  extends MenuItemCommonProps, AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /**
   * The item keeps the focus, and does not open the submenu.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A mouse that moves on the item opens the submenu.
   * @default true
   */
  openOnHover?: boolean | undefined;
  /**
   * The time in milliseconds from the first move on the item to the open.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * The time in milliseconds before the close, after the pointer moved to another item.
   * @default 0
   */
  closeDelay?: number | undefined;
}

export interface MenuSubmenuTriggerState {
  /** The submenu is open. */
  open: boolean;
  disabled: boolean;
  highlighted: boolean;
}

export interface MenuGroupProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MenuGroupState {}

export interface MenuGroupLabelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
}

export interface MenuGroupLabelState {}

export interface MenuSeparatorProps extends SeparatorProps {}

export interface MenuSeparatorState extends SeparatorState {}

export interface MenuListProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string | undefined;
}

export interface MenuListState {}

export type MenuFilter = Filter;

export type MenuFilterOptions = GetFilterParameters;

export type MenuFilterProviderChangeEventReason =
  'input-change' | 'input-clear' | 'clear-press' | 'popup-close';

export type MenuFilterProviderChangeEventDetails =
  ChangeEventDetails<MenuFilterProviderChangeEventReason>;

export interface MenuFilterProviderProps {
  /** The query. `v-model` binds it. */
  modelValue?: string | undefined;
  /**
   * The query at the mount of an uncontrolled provider.
   * @default ''
   */
  defaultValue?: string | undefined;
  /**
   * Says whether an item matches the query. It gets the `label` of the item, else its text, and
   * the query with no space at the ends. By default, an item matches when it contains the query,
   * with no regard to case, accents and punctuation. `null` shows each item.
   */
  filter?: ((text: string, query: string) => boolean) | null | undefined;
  /**
   * The first shown item gets the highlight: `true` while the query is not empty, `'always'` also
   * while it is empty.
   * @default false
   */
  autoHighlight?: boolean | 'always' | undefined;
  /** The locale of the default `filter`. With no value, the nearest `LocaleProvider`, else `en-US`. */
  locale?: Intl.LocalesArgument | undefined;
}

export interface MenuFilterProviderState {}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
type InputAttributes = Omit<
  InputHTMLAttributes,
  'as' | 'autocomplete' | 'disabled' | 'id' | 'value'
> & { autocomplete?: string | null | undefined };

export interface MenuInputProps extends /* @vue-ignore */ InputAttributes {
  id?: string | undefined;
  /**
   * The user cannot type in the input.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface MenuInputState {
  /** The input has the focus after a key, and no key moved the highlight to an item. */
  highlighted: boolean;
}

export interface MenuClearProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface MenuClearState {
  disabled: boolean;
}

export interface MenuEmptyProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MenuEmptyState {}
