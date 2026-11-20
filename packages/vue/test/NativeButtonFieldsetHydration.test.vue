<script setup lang="ts">
import { Fieldset } from '@vase-ui/vue/fieldset';

defineProps<{ fieldsetRoot?: boolean }>();
</script>

<template>
  <component :is="fieldsetRoot ? Fieldset.Root : 'fieldset'" disabled>
  </component>
</template>
