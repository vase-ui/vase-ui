<script setup lang="ts">
import { inject, mergeProps, shallowRef, watch } from 'vue';
import { useListItem, type List } from '../../src/list/list';

const props = defineProps<{
  itemKey: string;
  text?: string | undefined;
  disabled?: boolean;
  native?: boolean;
  hidden?: boolean;
  link?: boolean;
  /** The item renders no element. */
  absent?: boolean;
}>();
const list = inject<List>('list')!;
const element = shallowRef<HTMLElement | null>(null);
const { highlighted, attributes } = useListItem(list, element, {
  label: () => undefined,
  disabled: () => !!props.disabled && !props.native,
});
const highlightNotice = inject<(() => void) | undefined>('highlightNotice');
if (highlightNotice) watch(highlighted, () => {}, { onTrigger: highlightNotice });
const setElement = (el: unknown) => (element.value = el as HTMLElement | null);
</script>

<template>
  <template v-if="absent" />
  <button
    v-else-if="native"
    v-bind="mergeProps(attributes, { 'data-key': itemKey })"
    :ref="setElement"
    :disabled="disabled"
    :hidden="hidden"
    style="display: block; height: 30px"
  >
    {{ text ?? itemKey }}
  </button>
  <a
    v-else-if="link"
    v-bind="mergeProps(attributes, { 'data-key': itemKey })"
    :ref="setElement"
    href="#list"
    style="display: block; height: 30px"
  >
    {{ text ?? itemKey }}
  </a>
  <div
    v-else
    v-bind="mergeProps(attributes, { 'data-key': itemKey })"
    :ref="setElement"
    :hidden="hidden"
    :aria-disabled="disabled ? 'true' : undefined"
    style="height: 30px"
  >
    {{ text ?? itemKey }}
  </div>
</template>
