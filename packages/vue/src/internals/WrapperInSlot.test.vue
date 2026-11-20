<script setup lang="ts">
import { Fieldset } from '@vase-ui/vue/fieldset';
import { TimePicker } from '@vase-ui/vue/time-picker';

defineProps<{ closeOnSelect?: boolean }>();
</script>

<template>
  <Fieldset.Root>
    <TimePicker.Root :close-on-select="closeOnSelect"><slot /></TimePicker.Root>
  </Fieldset.Root>
</template>
