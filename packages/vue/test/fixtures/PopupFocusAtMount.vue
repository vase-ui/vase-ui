<script setup lang="ts">
import { onMounted, useTemplateRef, type DirectiveBinding, type PropType } from 'vue';

// An input that takes the focus in a hook of its own mount: `onMounted` of this component, or
// `mounted` of a directive on the input. It writes whether the input has the focus right after the
// call, and whether its popup shows.
const props = defineProps({
  mode: { type: String as PropType<'onMounted' | 'directive'>, required: true },
  log: {
    type: Object as PropType<{ add(entry: { focused: boolean; shown: boolean }): void }>,
    required: true,
  },
});
const input = useTemplateRef<HTMLInputElement>('input');

function focus(element: HTMLInputElement) {
  element.focus();
  props.log.add({
    focused: document.activeElement === element,
    shown: !!element.closest('[data-testid="popup"]')?.checkVisibility(),
  });
}

onMounted(() => {
  if (props.mode === 'onMounted' && input.value) focus(input.value);
});
const vFocus = {
  mounted(element: HTMLInputElement, binding: DirectiveBinding<string>) {
    if (binding.value === 'directive') focus(element);
  },
};
</script>

<template>
  <input ref="input" v-focus="mode" aria-label="Field" data-testid="field" />
</template>
