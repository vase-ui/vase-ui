<script setup lang="ts">
import { computed, h, shallowRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { Combobox } from '@vase-ui/vue/combobox';
import styles from './index.module.css';

interface VirtualizedItem {
  id: string;
  name: string;
}

const filteredItems = Combobox.useFilteredItems<VirtualizedItem>();

const scrollElement = shallowRef<HTMLDivElement | null>(null);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: filteredItems.value.length,
    getScrollElement: () => scrollElement.value,
    estimateSize: () => 32,
    overscan: 20,
    paddingStart: 4,
    paddingEnd: 4,
    scrollPaddingEnd: 4,
    scrollPaddingStart: 4,
  })),
);

const totalSize = computed(() => virtualizer.value.getTotalSize());
const rows = computed(() =>
  virtualizer.value.getVirtualItems().flatMap((virtualItem) => {
    const item = filteredItems.value[virtualItem.index];
    return item ? [{ virtualItem, item }] : [];
  }),
);

// Vue calls a function ref again on each patch, and `measure()` makes the next patch.
function setScrollElement(element: unknown) {
  if (element === scrollElement.value) {
    return;
  }
  scrollElement.value = element as HTMLDivElement | null;
  if (element) {
    virtualizer.value.measure();
  }
}

// A part gives its element through the exposed `element`.
function measureItem(item: unknown) {
  virtualizer.value.measureElement(
    (item as { element: HTMLElement | null } | null)?.element ?? null,
  );
}

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);

defineExpose({ virtualizer });
</script>

<template>
  <div
    v-if="filteredItems.length > 0"
    :ref="setScrollElement"
    role="presentation"
    :class="styles.Scroller"
    :style="{ '--total-size': `${totalSize}px` }"
  >
    <div
      role="presentation"
      :class="styles.VirtualizedPlaceholder"
      :style="{ height: `${totalSize}px` }"
    >
      <Combobox.Item
        v-slot="{ state }"
        v-for="{ virtualItem, item } in rows"
        :key="virtualItem.index"
        :ref="measureItem"
        :index="virtualItem.index"
        :data-index="virtualItem.index"
        :value="item"
        :class="styles.Item"
        :aria-setsize="filteredItems.length"
        :aria-posinset="virtualItem.index + 1"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualItem.size}px`,
          transform: `translateY(${virtualItem.start}px)`,
        }"
      >
        <span v-if="state.selected" :class="styles.ItemIndicator">
          <CheckIcon />
        </span>
        <span :class="styles.ItemText">{{ item.name }}</span>
      </Combobox.Item>
    </div>
  </div>
</template>
