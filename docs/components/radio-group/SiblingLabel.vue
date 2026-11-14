<script setup lang="ts">
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <div id="storage-type">Storage type</div>
  <RadioGroup default-value="ssd" aria-labelledby="storage-type">
    <div>
      <label for="storage-type-ssd">SSD</label>
      <Radio.Root id="storage-type-ssd" value="ssd" native-button as="button">
        <Radio.Indicator />
      </Radio.Root>
    </div>
  </RadioGroup>
</template>
