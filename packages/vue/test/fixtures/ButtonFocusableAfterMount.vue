<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue';
import { Button } from '../../src/button';

// A disabled button that sets `focusableWhenDisabled` at its mount. So its first render, as on a
// server, has the native `disabled`, and the update after its mount gives `aria-disabled`.
defineOptions({ inheritAttrs: false });
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));
const button = useTemplateRef<{ element: HTMLElement | null }>('button');
defineExpose({ element: computed(() => button.value?.element ?? null) });
</script>

<template>
  <Button ref="button" v-bind="$attrs" disabled :focusable-when-disabled="mounted"><slot /></Button>
</template>
