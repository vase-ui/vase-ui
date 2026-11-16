<script setup lang="ts">
import { computed, toRaw, watch } from 'vue';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../../src/combobox/root/ComboboxRootContext';

// The tests use this part in place of `Combobox.Positioner`, `Combobox.Popup`, `Combobox.List` and
// `Combobox.Item`. It renders the list while the root has it mounted, with one option for each
// filtered value, and a click on an option selects it. With no `items` on the root, `values` gives
// the options, and each option writes its value to the registry of the root.
defineProps<{ values?: readonly unknown[] | undefined }>();

const store = useComboboxRootContext();
const { flatFilteredValues, hasItems } = useComboboxDerivedItemsContext();
const mounted = computed(
  () => store.select('mounted') || store.select('inline') || store.select('forceMounted'),
);
const listProps = computed(() => store.select('listProps'));
const itemProps = computed(() => store.select('itemRoot').props);
const rootId = computed(() => store.select('id'));

function setPositionerElement(element: unknown) {
  if (toRaw(store.state).positionerElement !== element) {
    store.set('positionerElement', element as HTMLElement | null);
  }
}

function setPopupElement(element: unknown) {
  store.context.popupRef.value = element as HTMLElement | null;
}

function setListElement(element: unknown) {
  if (toRaw(store.state).listElement !== element) {
    store.set('listElement', element as HTMLElement | null);
  }
}

function setItemElement(index: number, value: unknown, element: unknown) {
  store.context.listRef.value[index] = element as HTMLElement | null;
  if (hasItems.value) {
    return;
  }
  if (element) {
    store.context.valuesRef.value[index] = value;
  } else {
    delete store.context.valuesRef.value[index];
  }
}

// `Combobox.Item` gives the element of the highlighted item to the store, and the input names its
// `id` in `aria-activedescendant`. The options do the same after each render of the list.
watch(
  [() => store.select('activeIndex'), mounted, flatFilteredValues],
  ([index]) => {
    store.set(
      'highlightedItem',
      index === null ? null : (store.context.listRef.value[index] ?? null),
    );
  },
  { flush: 'post' },
);

function getLabel(value: unknown) {
  return typeof value === 'object' && value !== null ? (value as { label: string }).label : value;
}
</script>

<template>
  <div v-if="mounted" :ref="setPositionerElement">
    <div :ref="setPopupElement">
      <div :id="`${rootId}-list`" :ref="setListElement" v-bind="listProps">
        <div
          v-for="(value, index) in hasItems ? flatFilteredValues : (values ?? [])"
          :id="`${rootId}-${index}`"
          :key="String(getLabel(value))"
          :ref="(element) => setItemElement(index, value, element)"
          role="option"
          v-bind="itemProps"
          @click="store.context.handleSelection($event, value)"
        >
          {{ getLabel(value) }}
        </div>
      </div>
    </div>
  </div>
</template>
