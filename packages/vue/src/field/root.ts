import { inject, type InjectionKey } from 'vue';
import type { FieldRootState, FieldValidity } from './types';

/** What `Field.Root` gives to its label, descriptions and errors. The properties are reactive. */
export interface FieldForParts {
  readonly state: FieldRootState;
  /** The id of the control, for the `for` of the label. */
  readonly controlId: string;
  readonly validity: FieldValidity;
  /** The messages of the last validation. */
  readonly errors: string[];
  /** The messages that the form has for the field. */
  readonly formErrors: string[];
  /** Adds a part to `aria-describedby` of the control. Returns the function that removes it. */
  addDescriber(describer: { readonly id: string; readonly shown: boolean }): () => void;
}

export const fieldPartsKey: InjectionKey<FieldForParts> = Symbol('field parts');

export function injectFieldRoot(part: string) {
  const field = inject(fieldPartsKey, null);
  if (!field) throw new Error(`Vase UI Field: <Field.${part}> must be inside <Field.Root>.`);
  return field;
}
