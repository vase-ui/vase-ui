<script setup lang="ts">
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <RadioGroup aria-label="Storage type">
    <label>
      <Radio value="ssd" />
      SSD
    </label>
  </RadioGroup>
</template>
