<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { OTPField } from '../../src/otp-field';

defineProps({ scene: { type: Object as PropType<{ disabled: boolean }>, required: true } });
</script>

<template>
  <Fieldset.Root :disabled="scene.disabled">
    <Fieldset.Legend id="legend">Code</Fieldset.Legend>
    <OTPField.Root :length="2">
      <OTPField.Input />
      <OTPField.Input />
    </OTPField.Root>
  </Fieldset.Root>
</template>
