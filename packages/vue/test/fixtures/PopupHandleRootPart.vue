<script setup lang="ts">
import { onBeforeMount, onScopeDispose, provide } from 'vue';
import { PopupHandleFixtureContext, PopupHandleFixtureStore } from './PopupHandleFixture';
import type { PopupHandleFixture } from './PopupHandleFixture';

const props = defineProps<{
  handle?: PopupHandleFixture | undefined;
  defaultOpen?: boolean | undefined;
  defaultTriggerId?: string | undefined;
}>();

const store = new PopupHandleFixtureStore({
  open: props.defaultOpen,
  activeTriggerId: props.defaultTriggerId,
});
provide(PopupHandleFixtureContext, store);

let detach: (() => void) | undefined;
// A server does not call `onBeforeMount`, so a server render never attaches the store.
onBeforeMount(() => {
  detach = props.handle?.attachStore(store);
});
onScopeDispose(() => detach?.());
</script>

<template>
  <slot />
</template>
