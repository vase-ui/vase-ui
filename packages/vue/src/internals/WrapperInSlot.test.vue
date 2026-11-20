<script setup lang="ts">
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Menubar } from '@vase-ui/vue/menubar';

defineProps<{ modal?: boolean }>();
</script>

<template>
  <Fieldset.Root>
    <Menubar :modal="modal"><slot /></Menubar>
  </Fieldset.Root>
</template>
