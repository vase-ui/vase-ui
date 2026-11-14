<script setup lang="ts">
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <div id="storage-type">Storage type</div>
  <RadioGroup default-value="ssd" aria-labelledby="storage-type">
    <Radio.Root value="ssd" native-button>
      <template #render="{ props }">
        <label>
          <button v-bind="props" />
          SSD
        </label>
      </template>
    </Radio.Root>
  </RadioGroup>
</template>
