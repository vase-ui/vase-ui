import { computed, useSlots } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useToastRootContext } from '../root/ToastRootContext';

/**
 * Tells if a value of a label has content to show. A function counts, because it returns the
 * content of the label.
 */
export function isRenderableNode(node: unknown): boolean {
  if (node == null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some(isRenderableNode);
  }
  return true;
}

/**
 * The shared logic of `Toast.Title` and `Toast.Description`.
 * The part renders only while it has content: a default slot, or the label of its toast. While it
 * renders, it registers its `id` with the root.
 */
export function useToastLabelPart(
  idProp: () => string | undefined,
  part: 'title' | 'description',
  element: MaybeRefOrGetter<Element | null | undefined>,
): {
  labelId: ComputedRef<string>;
  hasContent: () => boolean;
  state: ComputedRef<{ type: string | undefined }>;
} {
  const { toast, registerTitleId, registerDescriptionId } = useToastRootContext();
  const register = part === 'title' ? registerTitleId : registerDescriptionId;

  const labelId = useVaseUiId(idProp);
  const slots = useSlots();

  const hasContent = () => slots.default !== undefined || isRenderableNode(toast.value[part]);
  const state = computed(() => ({ type: toast.value.type }));

  useRegisteredId(() => labelId.value, register, element);

  return { labelId, hasContent, state };
}
