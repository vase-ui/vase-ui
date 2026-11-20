<script setup lang="ts">
import { useId } from 'vue';
import { OTPField } from '@vase-ui/vue/otp-field';

const OTP_LENGTH = 6;

const id = useId();
const labelId = `${id}-label`;
const descriptionId = `${id}-description`;
</script>

<template>
  <div class="flex w-full max-w-80 flex-col items-start gap-1">
    <label :id="labelId" :for="id" class="text-sm font-bold text-neutral-950 dark:text-white"
      >Verification code</label
    >
    <OTPField.Root
      :id="id"
      :aria-labelledby="labelId"
      :length="OTP_LENGTH"
      :aria-describedby="descriptionId"
      class="flex w-full gap-2"
    >
      <OTPField.Input
        v-for="index in OTP_LENGTH"
        :key="index"
        class="m-0 h-10 w-10 rounded-none border border-neutral-950 bg-white dark:bg-neutral-950 text-center font-inherit text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
        :aria-label="index === 1 ? undefined : `Character ${index} of ${OTP_LENGTH}`"
      />
    </OTPField.Root>
    <p :id="descriptionId" class="m-0 text-sm text-neutral-600 dark:text-neutral-400">
      Enter the 6-character code we sent to your device.
    </p>
  </div>
</template>
