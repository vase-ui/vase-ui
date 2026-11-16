<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';

withDefaults(
  defineProps<{
    defaultValue?: string | undefined;
    disabled?: boolean;
    firstDisabled?: boolean;
  }>(),
  { defaultValue: undefined, disabled: false, firstDisabled: false },
);
const emit = defineEmits<{ mount: [input: HTMLInputElement | null] }>();

const group = useTemplateRef('group');
onMounted(() => emit('mount', group.value?.inputElement ?? null));
</script>

<template>
  <RadioGroup ref="group" data-testid="group" :default-value="defaultValue" :disabled="disabled">
    <Radio.Root data-testid="a" value="a" :disabled="firstDisabled" />
    <Radio.Root data-testid="b" value="b" />
    <Radio.Root data-testid="c" value="c" />
  </RadioGroup>
</template>
