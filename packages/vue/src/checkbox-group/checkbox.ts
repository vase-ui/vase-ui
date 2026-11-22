import type { InjectionKey } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';

/** A checkbox with a `value` in a group, while it is mounted. The properties are reactive. */
export interface GroupCheckbox {
  readonly value: string;
  readonly id: string;
  readonly element: HTMLInputElement;
  readonly disabled: boolean;
}

/** What a group gives to its checkboxes. The properties are reactive. */
export interface CheckboxGroupForCheckbox {
  readonly value: readonly string[];
  readonly disabled: boolean;
  /** The group has `allValues`, so a checkbox with `parent` is its parent checkbox. */
  readonly hasAllValues: boolean;
  readonly parent: {
    readonly checked: boolean;
    readonly indeterminate: boolean;
    /** The ids of the checkboxes that the parent controls. */
    readonly controls: string | undefined;
  };
  /** The value and the checked state of the parent after a press on the parent. */
  nextOfParent(): { value: string[]; checked: boolean };
  /**
   * The user asks for `value`. Returns `false` when a listener cancelled it. `byChild` is `true`
   * for a press on a checkbox that is not the parent.
   */
  change(value: string[], details: ChangeEventDetails<'none'>, byChild: boolean): boolean;
  /** The user changed the value. The checkbox calls it after the render of the change. */
  onEdit(): void;
  /** A native reset of a form that owns a checkbox of the group. The group acts one time. */
  onReset(event: Event): void;
  /** Adds a checkbox with a `value`. Returns the function that removes it. */
  addCheckbox(checkbox: GroupCheckbox): () => void;
}

export const checkboxGroupKey: InjectionKey<CheckboxGroupForCheckbox> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'checkbox group' : undefined,
);
