<script setup lang="ts">
import { inject, mergeProps, shallowRef } from 'vue';
import { useListItem, type List } from '../../src/list/list';

const props = defineProps<{
  itemKey: string;
  text?: string | undefined;
  disabled?: boolean;
  native?: boolean;
  hidden?: boolean;
  link?: boolean;
}>();
const list = inject<List>('list')!;
const element = shallowRef<HTMLElement | null>(null);
const { attributes } = useListItem(list, element, {
  label: () => undefined,
  disabled: () => !!props.disabled && !props.native,
});
const setElement = (el: unknown) => (element.value = el as HTMLElement | null);
</script>

<template>
  <button
    v-if="native"
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
