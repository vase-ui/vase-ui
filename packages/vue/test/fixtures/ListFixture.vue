<script setup lang="ts">
import { provide, shallowRef, type PropType } from 'vue';
import { useList, type HighlightReason } from '../../src/list/list';
import { useTypeahead } from '../../src/menu/typeahead';
import ListFixtureItem from './ListFixtureItem.vue';

type Item = { key: string; text?: string; disabled?: boolean; native?: boolean; hidden?: boolean; link?: boolean };

// A list of items in a box that scrolls, with an input that owns the focus in virtual mode.
const props = defineProps({
  items: { type: Array as PropType<Item[]>, required: true },
  orientation: { type: String as PropType<'vertical' | 'horizontal'>, default: 'vertical' },
  loop: { type: Boolean, default: true },
  virtual: Boolean,
  canLeave: Boolean,
  dir: String,
  log: { type: Array as PropType<string[]>, default: () => [] },
});
const container = shallowRef<HTMLElement | null>(null);
const input = shallowRef<HTMLElement | null>(null);
const list = useList({
  orientation: () => props.orientation,
  loop: () => props.loop,
  container: () => container.value,
  owner: () => (props.virtual ? input.value : null),
  canLeave: () => props.canLeave,
  onHighlight: (item, reason: HighlightReason) =>
    props.log.push(`${item?.element.dataset.key ?? 'none'} ${reason}`),
});
const typeahead = useTypeahead(list);
provide('list', list);

function onKeydown(event: KeyboardEvent) {
  if (!typeahead.onKeydown(event)) list.onKeydown(event);
}
</script>

<template>
  <input v-if="virtual" :ref="(el) => (input = el as HTMLElement)" aria-label="Owner" @keydown="onKeydown" />
  <div
    :ref="(el) => (container = el as HTMLElement)"
    data-testid="container"
    tabindex="-1"
    :dir="dir"
    style="height: 90px; width: 200px; overflow: auto"
    @keydown="onKeydown"
  >
    <ListFixtureItem
      v-for="item in items"
      :key="item.key"
      :item-key="item.key"
      :text="item.text"
      :disabled="item.disabled"
      :native="item.native"
      :hidden="item.hidden"
      :link="item.link"
    />
  </div>
</template>
