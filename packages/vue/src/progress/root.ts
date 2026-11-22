import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { ProgressRootState } from './types';

/** What `Progress.Root` gives to its parts. The properties are reactive. */
export interface ProgressForParts {
  readonly state: ProgressRootState;
  /** The `value` prop of the root. */
  readonly value: number | null;
  readonly formattedValue: string | null;
  readonly percent: number | null;
  /** The id of a label with no `id` prop. */
  readonly labelId: string;
  /** Adds a label, for `aria-labelledby` of the root. Returns the function that removes it. */
  addLabel(label: { readonly id: string }): () => void;
}

export const progressKey: InjectionKey<ProgressForParts> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'progress' : undefined,
);

export function injectProgressRoot(part: string) {
  const root = inject(progressKey, null);
  if (!root) throw createError(51, part);
  return root;
}

export function statusAttributes({ status }: ProgressRootState) {
  const on = (value: boolean) => (value ? '' : undefined);
  return {
    'data-indeterminate': on(status === 'indeterminate'),
    'data-progressing': on(status === 'progressing'),
    'data-complete': on(status === 'complete'),
  };
}
