<script setup lang="ts">
import { computed, inject } from 'vue';
import { usePopupHandleStore } from '../../src/utils/popups/usePopupTrigger';
import { PopupHandleFixtureContext } from './PopupHandleFixture';
import type { PopupHandleFixture } from './PopupHandleFixture';

const props = defineProps<{
  id: string;
  handle?: PopupHandleFixture | undefined;
}>();

const rootStore = inject(PopupHandleFixtureContext, undefined);
const handleStore = usePopupHandleStore(() => props.handle);
const store = computed(() => handleStore.value ?? rootStore);
const isOpen = computed(() => store.value?.select('isOpenedByTrigger', props.id) ?? false);

// This fixture binds a plain object without `useRenderElement`. A read of the wrong store leaves
// the server values on the button, even for attributes that a library trigger corrects.
function elementProps() {
  return {
    id: props.id,
    'aria-expanded': isOpen.value,
    'data-popup-open': isOpen.value ? '' : undefined,
  };
}
</script>

<template>
  <button v-bind="elementProps()"><slot /></button>
</template>
