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
// This root attaches before the parts after it render. A trigger that hydrates after a mounted
// root gets the same state. A server does not call the hook, so a server render never attaches the
// store.
onBeforeMount(() => {
  detach = props.handle?.attachStore(store);
});
onScopeDispose(() => detach?.());
</script>

<template>
  <slot />
</template>
