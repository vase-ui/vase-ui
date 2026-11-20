import type { ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';

/** The values of the open items. */
export type AccordionValue<Value = any> = Value[];

export interface AccordionRootProps<Value = any>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The values of the open items. `v-model` binds it. With `null`, no item is open, and the root
   * stays controlled.
   */
  modelValue?: AccordionValue<Value> | null;
  /** The values of the open items at the mount of an uncontrolled root. `null` is no value. */
  defaultValue?: AccordionValue<Value> | null;
  /**
   * More than one item can be open at one time.
   * @default false
   */
  multiple?: boolean;
  /**
   * The user cannot open or close an item with its trigger.
   * @default false
   */
  disabled?: boolean;
  /**
   * A closed panel stays in the DOM, with `hidden` and `inert`, so its content keeps its state, and
   * the server HTML has it. `<Transition>` does not animate such a panel: animate it with CSS on
   * `[hidden]`. The `keepMounted` of a panel wins.
   * @default false
   */
  keepMounted?: boolean;
  /**
   * A closed panel stays in the DOM with `hidden="until-found"`, so that find-in-page of the
   * browser can find its text and open it. The `hiddenUntilFound` of a panel wins.
   * @default false
   */
  hiddenUntilFound?: boolean;
}

export interface AccordionRootState<Value = any> {
  /** The values of the open items. */
  value: AccordionValue<Value>;
  disabled: boolean;
}

/** `trigger-press` for a press of a trigger, `none` for a reveal by find-in-page. */
export type AccordionRootChangeEventReason = 'trigger-press' | 'none';

export type AccordionRootChangeEventDetails = ChangeEventDetails<AccordionRootChangeEventReason>;

export interface AccordionItemProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The value of the item in the value of the root. With none, the item has a generated value. */
  value?: any;
  /**
   * The user cannot open or close the item with its trigger. A disabled root also disables it.
   * @default false
   */
  disabled?: boolean;
}

export interface AccordionItemState extends AccordionRootState {
  open: boolean;
  /** By the item or by its root. */
  disabled: boolean;
}

export type AccordionItemChangeEventReason = AccordionRootChangeEventReason;

export type AccordionItemChangeEventDetails = AccordionRootChangeEventDetails;

export interface AccordionHeaderProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export type AccordionHeaderState = AccordionItemState;

export interface AccordionTriggerProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'id'> {
  /**
   * The user cannot press the trigger. A disabled item or root also disables it.
   * @default false
   */
  disabled?: boolean;
  /** The panel names the trigger by this id in `aria-labelledby`. */
  id?: string;
}

export interface AccordionTriggerState extends AccordionItemState {
  /** By the trigger, by its item or root, or by a disabled fieldset around a native button. */
  disabled: boolean;
}

export interface AccordionPanelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /**
   * A closed panel stays in the DOM, with `hidden` and `inert`, so its content keeps its state, and
   * the server HTML has it. `<Transition>` does not animate such a panel: animate it with CSS on
   * `[hidden]`. With none, the root decides.
   */
  keepMounted?: boolean;
  /**
   * A closed panel stays in the DOM with `hidden="until-found"`, so that find-in-page of the
   * browser can find its text and open it. With none, the root decides.
   */
  hiddenUntilFound?: boolean;
  /** The trigger names the panel by this id in `aria-controls`. */
  id?: string;
}

export type AccordionPanelState = AccordionItemState;
