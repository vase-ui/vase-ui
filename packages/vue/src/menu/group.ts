import { computed, inject, provide, shallowRef, type InjectionKey } from 'vue';
import { createError } from '../common/createError';

/** What a group gives to its label. */
export interface MenuGroupForLabel {
  /** Names the group with the id of the label. Returns the function that removes it. */
  setLabel(id: string): () => void;
}

export const groupLabelKey: InjectionKey<MenuGroupForLabel> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'menu group label' : undefined,
);

/** The `id` of the label of the group, while it is mounted. */
export function useGroupLabel() {
  const labelId = shallowRef<string>();
  provide(groupLabelKey, {
    setLabel(id) {
      labelId.value = id;
      // A template can mount the new label before it unmounts the old one.
      return () => {
        if (labelId.value === id) labelId.value = undefined;
      };
    },
  });
  return computed(() => labelId.value);
}

/** The group of a label. A label with no group throws an error. */
export function injectGroup() {
  const group = inject(groupLabelKey, null);
  if (!group) {
    throw createError(32);
  }
  return group;
}
