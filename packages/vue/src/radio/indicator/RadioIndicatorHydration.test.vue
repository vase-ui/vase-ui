<script setup lang="ts">
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';

withDefaults(defineProps<{ defaultValue?: string | undefined; keepMounted?: boolean }>(), {
  defaultValue: undefined,
  keepMounted: false,
});
</script>

<template>
  <RadioGroup :default-value="defaultValue">
    <Radio.Root value="a">
      <Radio.Indicator data-testid="indicator-a" :keep-mounted="keepMounted" />
    </Radio.Root>
    <Radio.Root value="b">
      <Radio.Indicator data-testid="indicator-b" :keep-mounted="keepMounted" />
    </Radio.Root>
  </RadioGroup>
</template>
