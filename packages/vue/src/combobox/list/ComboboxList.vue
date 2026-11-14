<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxListState {
  /**
   * Whether the list is empty.
   */
  empty: boolean;
}

export interface ComboboxListProps
  extends
    VaseUIComponentProps<ComboboxListState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, toRaw, watch } from 'vue';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { stopEvent } from '../../utils/popups/event';
import ComboboxCollection from '../collection/ComboboxCollection.vue';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { clickHighlightedItem, useListEmpty } from '../utils/parts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxListProps>(), { as: 'div' });

// Base UI wraps a function child in `Combobox.Collection`. A slot of Vue cannot show if it takes
// slot props, so the default slot holds the nodes and the `item` slot is the function child.
defineSlots<{
  default(props: { state: ComboboxListState }): unknown;
  item(props: { item: any; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxListState>;
}>();

const store = useComboboxRootContext();
const hasPositionerContext = Boolean(useComboboxPositionerContext(true));
const { hasItems } = useComboboxDerivedItemsContext();
const empty = useListEmpty();

const state = computed<ComboboxListState>(() => ({ empty: empty.value }));

// Base UI decides in each render. `virtualized` must not change while the list is mounted, as the
// items of Base UI require.
if (!toRaw(store.state).virtualized) {
  // With `items`, the root derives the labels of the typeahead from the items, so that they stay
  // when the list unmounts. The labels of the rendered items count only for a force-mounted list,
  // where the autofill matches the rendered text. The registry takes one labels ref for its life,
  // so the list gives it a ref of its own and copies the labels that count.
  const renderedLabels = shallowRef<Array<string | null>>([]);
  const countsRenderedLabels = () => !hasItems.value || store.select('forceMounted');
  useCompositeList({ elementsRef: store.context.listRef, labelsRef: renderedLabels });
  watch(
    [renderedLabels, countsRenderedLabels],
    ([labels, counts]) => {
      if (counts) {
        store.context.labelsRef.value = labels;
      }
    },
    { flush: 'sync' },
  );
  // The scope stops the watcher before the registry clears `renderedLabels`, so the list clears
  // the labels of the root itself, as the registry of Base UI does at its unmount.
  onScopeDispose(() => {
    if (countsRenderedLabels()) {
      store.context.labelsRef.value = [];
    }
  });
}

// A compiled template can mount a new list before it unmounts the old one. The old one then must
// not clear the elements of the new one.
let listElement: HTMLElement | null = null;
function setElements(list: HTMLElement | null) {
  const current = toRaw(store.state);
  if (list !== null || current.listElement === listElement) {
    store.set('listElement', list as HTMLDivElement | null);
  }
  if (!hasPositionerContext && (list !== null || current.positionerElement === listElement)) {
    store.set('positionerElement', list);
  }
  listElement = list;
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [setElements],
  props: (attrs) => {
    const grid = store.select('grid');
    return [
      store.select('listProps'),
      {
        tabindex: -1,
        id: store.select('defaultPopupId'),
        role: grid ? 'grid' : 'listbox',
        'aria-multiselectable': store.select('selectionMode') === 'multiple' ? 'true' : undefined,
        // On a grid the attribute describes cell editability, not selection, so it's left to the
        // combobox element in that mode.
        'aria-readonly': !grid && store.select('readOnly') ? true : undefined,
        onKeydown(event: KeyboardEvent) {
          const { disabled, readOnly, activeIndex } = toRaw(store.state);
          if (disabled || readOnly) {
            return;
          }

          if (event.key === 'Enter') {
            if (activeIndex == null) {
              // Allow form submission when no item is highlighted.
              return;
            }

            stopEvent(event);
            clickHighlightedItem(store, activeIndex, event);
          }
        },
      },
      attrs,
    ];
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"
    ><ComboboxCollection v-if="$slots.item"
      ><template #default="slotProps"
        ><slot name="item" v-bind="slotProps" /></template></ComboboxCollection
    ><slot v-else :state="state"
  /></component>
</template>
