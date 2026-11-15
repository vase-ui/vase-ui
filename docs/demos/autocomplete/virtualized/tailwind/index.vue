<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
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
    <label class="flex flex-col gap-1 text-sm font-bold text-neutral-950 dark:text-white">
      Search 10,000 items
      <Autocomplete.Input
        class="h-8 w-[16rem] border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
      />
    </label>

    <Autocomplete.Portal>
      <Autocomplete.Positioner class="outline-hidden" :side-offset="4">
        <Autocomplete.Popup
          class="w-[var(--anchor-width)] max-w-[var(--available-width)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
        >
          <Autocomplete.Empty>
            <div class="py-3 px-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
              No items found.
            </div>
          </Autocomplete.Empty>
          <Autocomplete.List class="p-0">
            <VirtualizedList ref="list" />
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
