<script setup lang="ts">
import { computed, inject } from 'vue';
import { usePopupHandleStore } from '../../src/utils/popups/usePopupHandleStore';
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

// Vue can patch a bound attribute, such as `:aria-expanded`, while it hydrates. It does not patch
// an attribute of a bound object, which is the form of the parts of the library. The fixture binds
// an object too, so a trigger that reads the wrong store shows a hydration mismatch.
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
