<script setup lang="ts">
import { useId } from 'vue';
import { OTPField } from '@vase-ui/vue/otp-field';
import styles from './index.module.css';

const OTP_LENGTH = 6;

const id = useId();
const labelId = `${id}-label`;
</script>

<template>
  <div :class="styles.Field">
    <label :id="labelId" :for="id" :class="styles.Label">Verification code</label>
    <OTPField.Root :id="id" :aria-labelledby="labelId" :length="OTP_LENGTH" :class="styles.Root">
      <div :class="styles.Group">
        <OTPField.Input
          v-for="index in 3"
          :key="index"
          :class="styles.Input"
          :aria-label="index === 1 ? undefined : `Character ${index} of ${OTP_LENGTH}`"
        />
      </div>
      <OTPField.Separator :class="styles.Separator" />
      <div :class="styles.Group">
        <OTPField.Input
          v-for="index in 3"
          :key="index + 3"
          :class="styles.Input"
          :aria-label="`Character ${index + 3} of ${OTP_LENGTH}`"
        />
      </div>
    </OTPField.Root>
  </div>
</template>
