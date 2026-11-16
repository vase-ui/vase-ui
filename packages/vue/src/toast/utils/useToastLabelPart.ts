import { computed, onBeforeUpdate, shallowRef, useSlots } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useToastRootContext } from '../root/ToastRootContext';
import { isRenderableNode } from './isRenderableNode';

/**
 * Tells if the consumer gives the part a default slot.
 * `$slots` is not reactive. A parent that adds or removes the slot renders the part again, so the
 * part reads the slots again before each render.
 */
export function useHasDefaultSlot(): Readonly<Ref<boolean>> {
  const slots = useSlots();
  const hasDefaultSlot = shallowRef(slots.default !== undefined);

  onBeforeUpdate(() => {
    hasDefaultSlot.value = slots.default !== undefined;
  });

  return hasDefaultSlot;
}

/**
 * The shared logic of `Toast.Title` and `Toast.Description`.
 * The part renders only while it has content: a default slot, or the label of its toast. While it
 * renders, it registers its `id` with the root.
 */
export function useToastLabelPart(
  idProp: () => string | undefined,
  part: 'title' | 'description',
): {
  labelId: ComputedRef<string>;
  rendered: ComputedRef<boolean>;
  state: ComputedRef<{ type: string | undefined }>;
} {
  const { toast, registerTitleId, registerDescriptionId } = useToastRootContext();
  const register = part === 'title' ? registerTitleId : registerDescriptionId;

  const labelId = useVaseUiId(idProp);
  const hasDefaultSlot = useHasDefaultSlot();

  const rendered = computed(() => hasDefaultSlot.value || isRenderableNode(toast.value[part]));
  const state = computed(() => ({ type: toast.value.type }));

  const source = Symbol();
  useRegisteredId(
    () => (rendered.value ? labelId.value : undefined),
    (getId) => register(source, getId),
  );

  return { labelId, rendered, state };
}
