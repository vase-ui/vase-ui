<script setup lang="ts">
import { useId } from 'vue';
import { OTPField } from '@vase-ui/vue/otp-field';
import styles from './index.module.css';

const CODE_LENGTH = 6;

const id = useId();
const descriptionId = `${id}-description`;
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Recovery code</label>
    <OTPField.Root
      :id="id"
      :length="CODE_LENGTH"
      validation-type="alphanumeric"
      :aria-describedby="descriptionId"
      :class="styles.Root"
    >
      <OTPField.Input
        v-for="index in CODE_LENGTH"
        :key="index"
        :class="styles.Input"
        :aria-label="index === 1 ? undefined : `Character ${index} of ${CODE_LENGTH}`"
      />
    </OTPField.Root>
    <p :id="descriptionId" :class="styles.Description">
      Accept letters and numbers for backup codes such as
      <span :class="styles.Code">A7C9XZ</span>.
    </p>
  </div>
</template>
