<script setup lang="ts">
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <div id="storage-type-label">Storage type</div>
  <RadioGroup aria-labelledby="storage-type-label">
    <label>
      <Radio.Root value="ssd" />
      SSD
    </label>
    <label>
      <Radio.Root value="hdd" />
      HDD
    </label>
  </RadioGroup>
</template>
