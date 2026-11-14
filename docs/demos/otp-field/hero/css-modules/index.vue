<script setup lang="ts">
import { useId } from 'vue';
import { OTPField } from '@vase-ui/vue/otp-field';
import styles from './index.module.css';

const OTP_LENGTH = 6;

const id = useId();
const descriptionId = `${id}-description`;
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Verification code</label>
    <OTPField.Root
      :id="id"
      :length="OTP_LENGTH"
      :aria-describedby="descriptionId"
      :class="styles.Root"
    >
      <OTPField.Input
        v-for="index in OTP_LENGTH"
        :key="index"
        :class="styles.Input"
        :aria-label="index === 1 ? undefined : `Character ${index} of ${OTP_LENGTH}`"
      />
    </OTPField.Root>
    <p :id="descriptionId" :class="styles.Description">
      Enter the 6-character code we sent to your device.
    </p>
  </div>
</template>
