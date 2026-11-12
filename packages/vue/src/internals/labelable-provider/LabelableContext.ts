import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import { EMPTY_ARRAY } from '../../common/empty';
import type { LabelIdSetter } from '../../utils/useRegisteredLabelId';
import { NOOP } from '../noop';

export type MessageIdsSetter = (next: string[] | ((current: string[]) => string[])) => void;

export interface LabelableContext {
  /**
   * The `id` of the labelable element.
   * When `null`, the label omits `for`, either because the association is implicit or
   * because the control takes its name from `aria-labelledby`.
   */
  controlId: ComputedRef<string | null | undefined>;
  registerControlId: (source: symbol, id: string | null | undefined) => void;
  resetControlId: () => void;
  /**
   * The `id` that a label registered.
   */
  labelId: ComputedRef<string | undefined>;
  setLabelId: LabelIdSetter;
  /**
   * The `id` that the provider made for a label that has no `id` of its own.
   */
  defaultLabelId: ComputedRef<string | undefined>;
  /**
   * The `id`s of the elements that give an accessible description.
   */
  messageIds: ComputedRef<string[]>;
  setMessageIds: MessageIdsSetter;
  getDescriptionProps: (externalProps: Record<string, any>) => Record<string, any>;
}

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)
 * with an accessible name (label) and description.
 */
export const LabelableContext: InjectionKey<LabelableContext> = Symbol();

// All apps and all server requests share this object, so it holds no state.
const DEFAULT_LABELABLE_CONTEXT: LabelableContext = {
  controlId: computed(() => undefined),
  registerControlId: NOOP,
  resetControlId: NOOP,
  labelId: computed(() => undefined),
  setLabelId: NOOP,
  defaultLabelId: computed(() => undefined),
  messageIds: computed(() => EMPTY_ARRAY),
  setMessageIds: NOOP,
  getDescriptionProps: (externalProps) => externalProps,
};

/**
 * Gives the labelable context of the nearest provider, or a context that does nothing when there
 * is none. A control then works with no field around it.
 * To find out if a provider is there, compare `registerControlId` with `NOOP`.
 */
export function useLabelableContext(): LabelableContext {
  return inject(LabelableContext, DEFAULT_LABELABLE_CONTEXT);
}
