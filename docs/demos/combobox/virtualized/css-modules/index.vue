<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import styles from './index.module.css';
import VirtualizedList from './VirtualizedList.vue';

const list = useTemplateRef<InstanceType<typeof VirtualizedList>>('list');

function scrollToHighlightedItem(
  item: VirtualizedItem | undefined,
  { reason, index }: Combobox.Root.HighlightEventDetails,
) {
  const virtualizer = list.value?.virtualizer;

  if (!item || !virtualizer) {
    return;
  }

  const isStart = index === 0;
  const isEnd = index === virtualizer.options.count - 1;
  const shouldScroll = reason === 'none' || (reason === 'keyboard' && (isStart || isEnd));

  if (shouldScroll) {
    queueMicrotask(() => {
      virtualizer.scrollToIndex(index, { align: isEnd ? 'start' : 'end' });
    });
  }
}

interface VirtualizedItem {
  id: string;
  name: string;
}

function getItemLabel(item: VirtualizedItem) {
  return item.name;
}

const virtualizedItems: VirtualizedItem[] = Array.from({ length: 10000 }, (_, index) => {
  const id = String(index + 1);
  const indexLabel = id.padStart(4, '0');
  return { id, name: `Item ${indexLabel}` };
});
</script>

<template>
  <Combobox.Root
    virtualized
    :items="virtualizedItems"
    :item-to-string-label="getItemLabel"
    @item-highlighted="scrollToHighlightedItem"
  >
    <label :class="styles.Label">
      Search 10,000 items
      <Combobox.Input :class="styles.Input" />
    </label>

    <Combobox.Portal>
      <Combobox.Positioner :class="styles.Positioner" :side-offset="4">
        <Combobox.Popup :class="styles.Popup">
          <Combobox.Empty>
            <div :class="styles.Empty">No items found.</div>
          </Combobox.Empty>
          <Combobox.List :class="styles.List">
            <VirtualizedList ref="list" />
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
