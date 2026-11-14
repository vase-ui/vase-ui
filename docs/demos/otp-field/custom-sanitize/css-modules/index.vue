<script setup lang="ts">
import { computed, useId } from 'vue';
import { OTPField } from '@vase-ui/vue/otp-field';
import { useInvalidFeedback } from '../useInvalidFeedback';
import styles from './index.module.css';

const CODE_LENGTH = 6;

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase();
}

function getInvalidClassName(invalidPulse: number, evenClassName: string, oddClassName: string) {
  if (invalidPulse === 0) {
    return '';
  }

  return invalidPulse % 2 === 0 ? evenClassName : oddClassName;
}

const id = useId();
const descriptionId = `${id}-description`;

const {
  activeInvalidIndex,
  handleValueChange,
  handleValueInvalid,
  invalidPulse,
  setFocusedIndex,
  statusMessage,
} = useInvalidFeedback();

const invalidClassName = computed(() =>
  getInvalidClassName(invalidPulse.value, styles.InputInvalidB, styles.InputInvalidA),
);
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Recovery code</label>
    <OTPField.Root
      :id="id"
      :length="CODE_LENGTH"
      validation-type="alphanumeric"
      :normalize-value="normalizeRecoveryCode"
      :aria-describedby="descriptionId"
      :class="styles.Root"
      @value-change="handleValueChange"
      @value-invalid="handleValueInvalid"
    >
      <OTPField.Input
        v-for="index in CODE_LENGTH"
        :key="index"
        :class="
          `${styles.Input} ${activeInvalidIndex === index - 1 ? invalidClassName : ''}`.trim()
        "
        :aria-label="index === 1 ? undefined : `Character ${index} of ${CODE_LENGTH}`"
        @focusin="setFocusedIndex(index - 1)"
      />
    </OTPField.Root>
    <p :id="descriptionId" :class="styles.Description">
      Letters and digits only. Letters are converted to uppercase.
    </p>
    <span aria-live="polite" :class="styles.ScreenReaderOnly">{{ statusMessage }}</span>
  </div>
</template>
