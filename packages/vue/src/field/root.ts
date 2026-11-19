import { inject, type InjectionKey } from 'vue';
import type { FieldRootState, FieldValidity } from './types';

/**
 * What `Field.Root` or `Field.Item` gives to its label, descriptions and errors. The properties
 * are reactive.
 */
export interface FieldForParts {
  readonly state: FieldRootState;
  /** The id of the control, for the `for` of the label. A group has none. */
  readonly controlId: string | undefined;
  readonly validity: FieldValidity;
  /** The messages of the last validation. */
  readonly errors: string[];
  /** The messages that the form has for the field. */
  readonly formErrors: string[];
  /** Adds a part to `aria-describedby` of the control. Returns the function that removes it. */
  addDescriber(describer: { readonly id: string; readonly shown: boolean }): () => void;
  /**
   * Adds a label, for `aria-labelledby` of a group, and of a control that a label which is not a
   * `<label>` names. Returns the function that removes it.
   */
  addLabel(label: FieldLabel): () => void;
  /** Moves the focus to the control, for a click on a label that is not a `<label>`. */
  focusControl(): void;
}

export interface FieldLabel {
  readonly id: string;
  /** The element of the label is a `<label>`. It is `true` until the mount. */
  readonly native: boolean;
}

export const fieldPartsKey: InjectionKey<FieldForParts> = Symbol('field parts');

export function injectFieldRoot(part: string) {
  const field = inject(fieldPartsKey, null);
  if (!field) throw new Error(`Vase UI Field: <Field.${part}> must be inside <Field.Root>.`);
  return field;
}

/** The ids of the parts that are shown, joined for an ARIA attribute. */
export function joinIds(parts: readonly { readonly id: string; readonly shown?: boolean }[]) {
  return (
    parts
      .filter((part) => part.shown !== false)
      .map((part) => part.id)
      .join(' ') || undefined
  );
}
