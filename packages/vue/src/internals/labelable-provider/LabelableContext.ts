import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import { EMPTY_ARRAY } from '../../common/empty';
import { NOOP } from '../noop';

/**
 * Registers the `id` of a part with the provider, or removes the registration of the source when
 * `getId` is `undefined`. The provider calls the getter each time it needs the `id`, so the part
 * registers one time and keeps its place in the order of the registrations. A part that registers
 * again after its removal goes to the end. The getter returns `undefined` for a part that has no
 * `id` now, such as a part that `KeepAlive` holds.
 */
export type RegisterId<Id = string> = (
  source: symbol,
  getId: (() => Id | undefined) | undefined,
) => void;

export interface LabelableContext {
  /**
   * The `id` that the control binds.
   * When `null`, the label omits `for`, either because the association is implicit or
   * because the control takes its name from `aria-labelledby`.
   */
  controlId: ComputedRef<string | null | undefined>;
  registerControlId: RegisterId<string | null>;
  resetControlId: () => void;
  /**
   * The `id` that a label names: the `id` of the control element. A `#render` slot can give that
   * element another `id` than `controlId`. It is `controlId` on a server, while `controlId` is
   * `null`, and while a control element has that `id` or no control element has an `id`.
   */
  controlElementId: ComputedRef<string | null | undefined>;
  registerControlElementId: RegisterId;
  /**
   * The `id` of the last label that has one.
   * It is `undefined` when no label has an `id`.
   */
  labelId: ComputedRef<string | undefined>;
  registerLabelId: RegisterId;
  /**
   * The `id`s of the elements that give an accessible description, in the order of the parts.
   */
  messageIds: ComputedRef<string[]>;
  registerMessageId: RegisterId;
  getDescriptionProps: (externalProps: Record<string, any>) => Record<string, any>;
}

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)
 * with an accessible name (label) and description.
 */
export const LabelableContext: InjectionKey<LabelableContext | null> = Symbol();

// All apps and all server requests share this object, so it holds no state.
const DEFAULT_LABELABLE_CONTEXT: LabelableContext = {
  controlId: computed(() => undefined),
  registerControlId: NOOP,
  resetControlId: NOOP,
  controlElementId: computed(() => undefined),
  registerControlElementId: NOOP,
  labelId: computed(() => undefined),
  registerLabelId: NOOP,
  messageIds: computed(() => EMPTY_ARRAY),
  registerMessageId: NOOP,
  getDescriptionProps: (externalProps) => externalProps,
};

/**
 * Gives the labelable context of the nearest provider, or a context that does nothing when there
 * is none. A control then works with no field around it.
 */
export function useLabelableContext(): LabelableContext {
  return inject(LabelableContext, null) ?? DEFAULT_LABELABLE_CONTEXT;
}
