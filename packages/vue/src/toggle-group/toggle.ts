import type { InjectionKey } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';

/** A toggle of a group, while it is mounted. The properties are reactive. */
export interface GroupToggle {
  readonly value: string;
  readonly element: HTMLElement;
  /** The toggle is disabled, by each cause. */
  readonly disabled: boolean;
}

/** What a group gives to its toggles. The properties are reactive. */
export interface ToggleGroupForToggle {
  readonly value: readonly string[];
  /** By the group, a toolbar or a `Toolbar.Group`. A fieldset disables only a native toggle. */
  readonly disabled: boolean;
  /** The group has `modelValue` or `defaultValue`, for the message of a toggle with no value. */
  readonly hasValue: boolean;
  /** The tab stop, after the mount of the toggles. A group in a toolbar has none. */
  readonly tabStop: GroupToggle | undefined;
  /** The user pressed a toggle. Returns `false` when a listener cancelled the change. */
  press(value: string, pressed: boolean, details: ChangeEventDetails<'none'>): boolean;
  /** Adds a toggle. Returns the function that removes it. */
  addToggle(toggle: GroupToggle): () => void;
}

export const toggleGroupKey: InjectionKey<ToggleGroupForToggle> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'toggle group' : undefined,
);
