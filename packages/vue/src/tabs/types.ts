import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';

export type TabsRootOrientation = 'horizontal' | 'vertical';

/** The value of a tab. `null` is no tab. */
export type TabsTabValue = any;

/** The side of the new active tab from the old one. */
export type TabsTabActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none';

/** The place of the active tab in the layout of its list, in pixels. */
export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The size of the active tab, in pixels. */
export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsRootProps<Value = any>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The value of the active tab. With `null`, no tab is active. */
  modelValue?: Value | null;
  /**
   * The value of the active tab at the mount of an uncontrolled root. With no value, the first tab
   * that is not disabled is active. With `null`, no tab is active.
   */
  defaultValue?: Value | null;
  /**
   * The direction in which the tabs follow each other.
   * @default 'horizontal'
   */
  orientation?: TabsRootOrientation;
}

export interface TabsRootState {
  /** The direction in which the tabs follow each other. */
  orientation: TabsRootOrientation;
  /** The side of the active tab from the tab that was active before it. */
  tabActivationDirection: TabsTabActivationDirection;
}

/**
 * `none` for a change by the user. The root changes its value itself for the other reasons: the
 * first tab at the mount (`initial`), a disabled active tab (`disabled`), and a value that no tab has
 * (`missing`).
 */
export type TabsRootChangeEventReason = 'none' | 'initial' | 'disabled' | 'missing';

export interface TabsRootChangeEventDetails extends ChangeEventDetails<TabsRootChangeEventReason> {
  /** The side of the new active tab from the old one. */
  activationDirection: TabsTabActivationDirection;
}

export interface TabsListProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * An arrow key, Home and End also make the tab that gets the focus active.
   * @default false
   */
  activateOnFocus?: boolean;
  /**
   * An arrow key moves the focus from the last tab to the first, and from the first to the last.
   * @default true
   */
  loopFocus?: boolean;
}

export type TabsListState = TabsRootState;

export interface TabsTabProps<Value = any>
  extends
    AsProps,
    /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id' | 'value'> {
  /** The value that the root gets when the user chooses this tab. */
  value: Value;
  /**
   * The user cannot choose the tab. The tab can still get the focus, so the arrow keys reach it. A
   * `click` listener on it does not run.
   * @default false
   */
  disabled?: boolean;
  /** The panel names the tab by this id in `aria-labelledby`. */
  id?: string;
}

export interface TabsTabState extends TabsRootState {
  /** The value of the root is the value of the tab. */
  active: boolean;
  /** The `disabled` prop of the tab. */
  disabled: boolean;
}

export interface TabsPanelProps<Value = any>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The value of the tab that opens the panel. */
  value: Value;
  /**
   * A closed panel stays in the DOM, with `hidden` and `inert`, so its content keeps its state, and
   * find-in-page and the server HTML have it. `<Transition>` does not animate such a panel: animate
   * it with CSS on `[hidden]`.
   * @default false
   */
  keepMounted?: boolean;
  /** The tab names the panel by this id in `aria-controls`. */
  id?: string;
}

export interface TabsPanelState extends TabsRootState {
  /** The panel is closed. */
  hidden: boolean;
}

export interface TabsIndicatorProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The server HTML has a script that places the indicator before the app starts. Use it when the
   * page shows the server HTML for some time. The script has the nonce of the nearest
   * `CSPProvider`.
   * @default false
   */
  renderBeforeHydration?: boolean;
}

export interface TabsIndicatorState extends TabsRootState {
  /** The place of the active tab in the layout of the list, or `null` before a measure. */
  activeTabPosition: TabsTabPosition | null;
  /** The size of the active tab, or `null` before a measure. */
  activeTabSize: TabsTabSize | null;
}
