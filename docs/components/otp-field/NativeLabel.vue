<script setup lang="ts">
import { OTPField } from '@vase-ui/vue/otp-field';
</script>

<template>
  <div>
    <label for="verification-code">Verification code</label>
    <OTPField.Root
      id="verification-code"
      :length="6"
      aria-describedby="verification-code-description"
    >
      <OTPField.Input />
      <OTPField.Input aria-label="Character 2 of 6" />
      <OTPField.Input aria-label="Character 3 of 6" />
      <OTPField.Input aria-label="Character 4 of 6" />
      <OTPField.Input aria-label="Character 5 of 6" />
      <OTPField.Input aria-label="Character 6 of 6" />
    </OTPField.Root>
    <p id="verification-code-description">Enter the 6-character code we sent to your device.</p>
  </div>
</template>
