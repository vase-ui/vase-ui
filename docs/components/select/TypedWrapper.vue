<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';

type Font = 'serif' | 'sans' | 'mono';

// The type arguments are `Value` and `Multiple`.
const FontSelect = Select.Root<Font, false>;

function log(value: Font | null) {
  console.log(value);
}
</script>

<template>
  <FontSelect default-value="serif" @value-change="log">
    <!-- ... -->
  </FontSelect>
</template>
