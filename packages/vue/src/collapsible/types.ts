import type { ButtonHTMLAttributes, Component, HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';

export interface CollapsibleRootProps extends /* @vue-ignore */ HTMLAttributes {
  /** A tag or a component in place of the `<div>`. The `element` slot wins over it. */
  as?: keyof HTMLElementTagNameMap | Component;
  /** The panel is open. `v-model:open` binds it. */
  open?: boolean;
  /**
   * The panel is open at the mount of an uncontrolled root.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * The user cannot open or close the panel with the trigger.
   * @default false
   */
  disabled?: boolean;
}

export interface CollapsibleRootState {
  open: boolean;
  disabled: boolean;
}

/** `trigger-press` for a press of the trigger, `none` for a reveal by find-in-page. */
export type CollapsibleRootChangeEventReason = 'trigger-press' | 'none';

export type CollapsibleRootChangeEventDetails =
  ChangeEventDetails<CollapsibleRootChangeEventReason>;

export interface CollapsibleTriggerProps extends /* @vue-ignore */ Omit<
  ButtonHTMLAttributes,
  'disabled'
> {
  /** A tag or a component in place of the `<button>`. The `element` slot wins over it. */
  as?: keyof HTMLElementTagNameMap | Component;
  /**
   * The user cannot press the trigger. A disabled root also disables it.
   * @default false
   */
  disabled?: boolean;
}

export interface CollapsibleTriggerState extends CollapsibleRootState {
  /** By the trigger, by its root, or by a disabled fieldset around a native button. */
  disabled: boolean;
}

export interface CollapsiblePanelProps extends /* @vue-ignore */ Omit<HTMLAttributes, 'id'> {
  /** A tag or a component in place of the `<div>`. The `element` slot wins over it. */
  as?: keyof HTMLElementTagNameMap | Component;
  /**
   * A closed panel stays in the DOM, with `hidden` and `inert`.
   * @default false
   */
  keepMounted?: boolean;
  /**
   * A closed panel stays in the DOM with `hidden="until-found"`, so that find-in-page of the
   * browser can find its text and open it.
   * @default false
   */
  hiddenUntilFound?: boolean;
  /** The trigger names the panel by this id in `aria-controls`. */
  id?: string;
}

export type CollapsiblePanelState = CollapsibleRootState;
