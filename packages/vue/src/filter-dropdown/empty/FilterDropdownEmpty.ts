import { computed, onMounted, shallowRef } from 'vue';
import type { ComputedRef } from 'vue';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import type { UseRenderElementParameters } from '../../internals/useRenderElement';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';

/**
 * The message of a filter dropdown that has no visible item. The part that calls it renders its
 * element only while `visible` is `true`, and gives `ref` and `props` to `useRenderElement` with
 * the default tag `div`.
 *
 * Call it in `setup`.
 *
 * @internal
 */
export function useFilterDropdownEmpty(): UseFilterDropdownEmptyReturnValue {
  const { store } = useFilterDropdownItemContext();

  const isEmpty = computed(() => store.select('isEmpty'));

  // Items mounting with the message register when they are mounted, after this first render, and
  // don't register on the server at all. Deciding once they have keeps the children from
  // mounting for a frame on every open, and the message out of server markup.
  const ready = shallowRef(false);
  onMounted(() => {
    ready.value = true;
  });

  const visible = computed(() => ready.value && isEmpty.value);

  const emptyRef = useInitialLiveRegionTextMutation<HTMLElement>(visible);

  const ownProps = {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': true,
  } as const;

  return {
    visible,
    ref: emptyRef,
    props: (attrs) => [ownProps, attrs],
  };
}

export interface FilterDropdownEmptyState {}

export interface UseFilterDropdownEmptyReturnValue {
  /** Whether the message renders: the mount is done and no item is visible. */
  visible: ComputedRef<boolean>;
  /** The function ref of the message element. */
  ref: (element: HTMLElement | null) => void;
  props: NonNullable<UseRenderElementParameters<FilterDropdownEmptyState>['props']>;
}
