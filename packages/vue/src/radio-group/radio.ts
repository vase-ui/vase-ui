import type { InjectionKey } from 'vue';

/** A radio of a group, while it is mounted. The properties are reactive. */
export interface GroupRadio {
  readonly value: unknown;
  readonly element: HTMLInputElement;
  /** The radio is disabled, by each cause. */
  readonly disabled: boolean;
}

/** What a group gives to its radios. The properties are reactive. */
export interface RadioGroupForRadio {
  readonly value: unknown;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  /** The tab stop of the group, after the mount of its radios. */
  readonly tabStop: GroupRadio | undefined;
  /** The user chose the radio with this value. `event` is its native `change` event. */
  select(value: unknown, event: Event): void;
  /** A native reset of a form that owns a radio of the group. The group acts one time. */
  onReset(event: Event): void;
  /** Adds a radio. Returns the function that removes it. */
  addRadio(radio: GroupRadio): () => void;
}

export const radioGroupKey: InjectionKey<RadioGroupForRadio> = Symbol('radio group');
