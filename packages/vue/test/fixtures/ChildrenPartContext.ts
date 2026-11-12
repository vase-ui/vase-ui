import type { ComputedRef, InjectionKey } from 'vue';
import type { ChildrenPartState } from './ChildrenPart.vue';

export const CHILDREN_PART_STATE: InjectionKey<ComputedRef<ChildrenPartState>> = Symbol();
