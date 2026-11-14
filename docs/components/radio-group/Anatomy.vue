<script setup lang="ts">
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <RadioGroup>
    <Radio.Root value="ssd">
      <Radio.Indicator />
    </Radio.Root>
  </RadioGroup>
</template>
