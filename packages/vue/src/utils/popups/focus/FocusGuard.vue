<script lang="ts">
import type { HTMLAttributes } from 'vue';

export interface FocusGuardProps extends /* @vue-ignore */ HTMLAttributes {}
</script>

<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { getFocusGuardAttributes, isFocusGuardButton } from './focusGuardAttributes';

// As in Base UI, the attributes of the guard win over those of a consumer, `style` included.
defineOptions({ inheritAttrs: false });
defineProps<FocusGuardProps>();

const element = shallowRef<HTMLSpanElement | null>(null);
const isButton = shallowRef(false);

// A server calls no mount hook and cannot know the engine, so the server HTML has the hidden form.
onMounted(() => {
  isButton.value = isFocusGuardButton();
});

defineExpose({ element });
</script>

<template>
  <span v-bind="{ ...$attrs, ...getFocusGuardAttributes(isButton) }" ref="element" />
</template>
