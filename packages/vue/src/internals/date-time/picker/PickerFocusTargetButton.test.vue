<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { usePickerFocusTarget } from './usePickerPopup';

// A part of the popup that gives its button as the focus target, unless `gives` is `false`. `ask`
// is called each time that the popup asks for the target.
const props = withDefaults(defineProps<{ gives?: boolean; ask?: () => void }>(), {
  gives: true,
  ask: undefined,
});
const button = useTemplateRef<HTMLButtonElement>('button');

usePickerFocusTarget(() => {
  props.ask?.();
  return props.gives ? button.value : null;
});
</script>

<template>
  <button ref="button" type="button"><slot /></button>
</template>
