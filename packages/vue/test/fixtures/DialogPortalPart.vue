<script setup lang="ts">
import { computed, provide } from 'vue';
import { DialogPortalContext } from '../../src/dialog/portal/DialogPortalContext';

// The tests use this part in place of `Dialog.Portal`. It gives the portal context to the parts
// below it.
const props = withDefaults(defineProps<{ keepMounted?: boolean }>(), { keepMounted: false });

provide(
  DialogPortalContext,
  computed(() => props.keepMounted),
);
</script>

<template>
  <slot />
</template>
