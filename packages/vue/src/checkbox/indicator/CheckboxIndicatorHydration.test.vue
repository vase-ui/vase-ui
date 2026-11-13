<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';

defineProps<{
  defaultChecked?: boolean;
  indeterminate?: boolean;
  keepMounted?: boolean;
}>();
</script>

<template>
  <Checkbox.Root
    aria-label="Notifications"
    :default-checked="defaultChecked"
    :indeterminate="indeterminate"
  >
    <Checkbox.Indicator data-testid="indicator" :keep-mounted="keepMounted" />
  </Checkbox.Root>
</template>
