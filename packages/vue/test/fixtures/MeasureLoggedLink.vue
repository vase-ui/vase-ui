<script setup lang="ts">
import { onScopeDispose, type PropType } from 'vue';

// A link that writes the end of the scope of its component, and each `focusout` with the place of
// the link in that moment and one task later.
const props = defineProps({ log: { type: Array as PropType<string[]>, required: true } });
onScopeDispose(() => props.log.push('scope stopped'));

function onFocusout(event: FocusEvent) {
  const link = event.target as Element;
  props.log.push(`focusout connected=${link.isConnected}`);
  setTimeout(() => props.log.push(`a task later connected=${link.isConnected}`));
}
</script>

<template>
  <a id="removed" href="#removed" @focusout="onFocusout">Link</a>
</template>
