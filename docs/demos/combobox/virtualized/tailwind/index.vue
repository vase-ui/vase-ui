<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import VirtualizedList from './VirtualizedList.vue';

const open = shallowRef(false);
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
    v-model:open="open"
    :item-to-string-label="getItemLabel"
    @item-highlighted="scrollToHighlightedItem"
  >
    <label class="flex flex-col gap-1 text-sm leading-5 font-bold text-neutral-950 dark:text-white">
      Search 10,000 items
      <Combobox.Input
        class="h-8 w-64 border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
      />
    </label>

    <Combobox.Portal>
      <Combobox.Positioner class="outline-none" :side-offset="4">
        <Combobox.Popup
          class="w-[var(--anchor-width)] max-w-[var(--available-width)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0_rgb(0_0_0_/_12%)] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
        >
          <Combobox.Empty>
            <div class="py-3 px-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
              No items found.
            </div>
          </Combobox.Empty>
          <Combobox.List class="p-0">
            <VirtualizedList ref="list" :open="open" />
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
