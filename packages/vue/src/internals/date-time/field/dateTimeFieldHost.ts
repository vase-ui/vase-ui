import { inject } from 'vue';
import type { InjectionKey } from 'vue';

/**
 * What a part that renders a field root gives to the root, such as a field of a range picker. The
 * root has no prop for it, because the `id` prop of a root is the id of its first segment.
 */
export interface DateTimeFieldHost {
  /**
   * The `id` of the group element of the root. The part names the group by that `id`, so that the
   * name of the group holds the `aria-label` of the group and a label.
   */
  groupId: string;
}

export const DateTimeFieldHostContext: InjectionKey<DateTimeFieldHost> = Symbol();

/** The host of the root, or `undefined` when no part gives one. */
export function useDateTimeFieldHost(): DateTimeFieldHost | undefined {
  return inject(DateTimeFieldHostContext, undefined);
}
