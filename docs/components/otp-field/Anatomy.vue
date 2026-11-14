<script setup lang="ts">
import { OTPField } from '@vase-ui/vue/otp-field';
</script>

<template>
  <OTPField.Root :length="1">
    <OTPField.Input />
    <OTPField.Separator />
  </OTPField.Root>
</template>
