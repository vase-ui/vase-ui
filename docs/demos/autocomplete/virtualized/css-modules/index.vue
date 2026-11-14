<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import styles from './index.module.css';
import VirtualizedList from './VirtualizedList.vue';

const list = useTemplateRef<InstanceType<typeof VirtualizedList>>('list');

function scrollToHighlightedItem(
  item: VirtualizedItem | undefined,
  { reason, index }: Autocomplete.Root.HighlightEventDetails,
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

function getItemLabel(item: VirtualizedItem | null) {
  return item ? item.name : '';
}

const virtualizedItems: VirtualizedItem[] = Array.from({ length: 10000 }, (_, index) => {
  const id = String(index + 1);
  const indexLabel = id.padStart(4, '0');
  return { id, name: `Item ${indexLabel}` };
});
</script>

<template>
  <Autocomplete.Root
    virtualized
    :items="virtualizedItems"
    open-on-input-click
    :item-to-string-value="getItemLabel"
    @item-highlighted="scrollToHighlightedItem"
  >
    <label :class="styles.Label">
      Search 10,000 items
      <Autocomplete.Input :class="styles.Input" />
    </label>

    <Autocomplete.Portal>
      <Autocomplete.Positioner :class="styles.Positioner" :side-offset="4">
        <Autocomplete.Popup :class="styles.Popup">
          <Autocomplete.Empty>
            <div :class="styles.Empty">No items found.</div>
          </Autocomplete.Empty>
          <Autocomplete.List :class="styles.List">
            <VirtualizedList ref="list" />
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
