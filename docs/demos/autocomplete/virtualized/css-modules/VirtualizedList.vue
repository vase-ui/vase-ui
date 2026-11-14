<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import styles from './index.module.css';

interface VirtualizedItem {
  id: string;
  name: string;
}

const filteredItems = Autocomplete.useFilteredItems<VirtualizedItem>();

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
const virtualItems = computed(() => virtualizer.value.getVirtualItems());

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
      <Autocomplete.Item
        v-for="virtualItem in virtualItems"
        :key="virtualItem.index"
        :ref="measureItem"
        :index="virtualItem.index"
        :data-index="virtualItem.index"
        :value="filteredItems[virtualItem.index]"
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
        {{ filteredItems[virtualItem.index]?.name }}
      </Autocomplete.Item>
    </div>
  </div>
</template>
