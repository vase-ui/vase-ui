import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * The message that the error shows: one text, or a list of more than one text. It is the message of
 * the last time that the error showed while the error animates out.
 */
export type FieldErrorContext = ComputedRef<string | string[] | null | undefined>;

export const FieldErrorContext: InjectionKey<FieldErrorContext> = Symbol();

export function useFieldErrorContext(): FieldErrorContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(FieldErrorContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of <Field.Error> must be inside <Field.Error>. Without the part it has no message to show. Mount the `children` component in the element of the `#render` slot of <Field.Error>.',
    );
  }

  return context;
}
