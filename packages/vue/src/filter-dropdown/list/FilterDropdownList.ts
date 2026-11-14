import { computed, onScopeDispose, provide, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { getTarget } from '../../common/shadowDom';
import type { UseRenderElementParameters } from '../../internals/useRenderElement';
import { FilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { useFilterDropdownRootContext } from '../root/FilterDropdownRootContext';
import { refocusOwner } from '../utils/refocusOwner';

/**
 * The list of a filter dropdown. The part that calls it gives `props` to `useRenderElement` with
 * the default tag `div`.
 *
 * The list's groups and items belong to this root's query. A nested root's list renders inside an
 * enclosing group, which must not count them as its own members. The composable thus provides no
 * group context. Call it in `setup`.
 *
 * @internal
 */
export function useFilterDropdownList(
  params: UseFilterDropdownListParameters = {},
): UseFilterDropdownListReturnValue {
  const context = useFilterDropdownRootContext();

  const id = computed(() => toValue(params.id) ?? context.defaultListId.value);

  // The root names the list with the id that the list renders. A generated id is not a request, so
  // removing an explicit id gives the generated id back.
  watch(
    () => (id.value === context.defaultListId.value ? undefined : id.value),
    context.setRenderedListId,
    { immediate: true },
  );
  onScopeDispose(() => context.setRenderedListId(undefined));

  provide(FilterDropdownGroupContext, null);

  const listeners = {
    onFocusin(event: FocusEvent) {
      // A press on the list's own content, such as its background, a group, or a group label,
      // focuses the list.
      const owner = context.focusOwnerRef.value;
      if (owner && event.relatedTarget === owner && getTarget(event) === event.currentTarget) {
        refocusOwner(owner);
      }
    },
    onPointermove() {
      context.setKeyboardModality(false);
    },
    onPointerdown() {
      context.setKeyboardModality(false);
    },
  };

  return {
    id,
    props: (attrs) => [
      {
        // Chromium includes scrollable elements in sequential focus navigation by default.
        tabindex: -1,
        id: id.value,
        ...listeners,
      },
      attrs,
    ],
  };
}

export interface FilterDropdownListState {}

export interface UseFilterDropdownListParameters {
  /** The `id` of the list. The id that the root generates when `undefined`. */
  id?: MaybeRefOrGetter<string | undefined> | undefined;
}

export interface UseFilterDropdownListReturnValue {
  /** The id that the list renders. */
  id: ComputedRef<string>;
  props: NonNullable<UseRenderElementParameters<FilterDropdownListState>['props']>;
}
