import { provide, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { getTarget } from '../../common/shadowDom';
import { given } from '../../internals/givenAttributes';
import type { UseRenderElementParameters } from '../../internals/useRenderElement';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { useKeepAliveElementRef } from '../../utils/popups/useKeepAliveElementRef';
import { FilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { useFilterDropdownRootContext } from '../root/FilterDropdownRootContext';
import { refocusOwner } from '../utils/refocusOwner';

/**
 * The list of a filter dropdown. The part that calls it gives `ref` and `props` to
 * `useRenderElement` with the default tag `div`.
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
    ref: useKeepAliveElementRef(createElementSetter(context.listElement)),
    props: (attrs) => [
      {
        // Chromium includes scrollable elements in sequential focus navigation by default.
        tabindex: -1,
        id: given('id', toValue(params.id)) ?? context.defaultListId.value,
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
  /** The function ref of the list element. The root reads the `id` of that element. */
  ref: (element: HTMLElement | null) => void;
  props: NonNullable<UseRenderElementParameters<FilterDropdownListState>['props']>;
}
