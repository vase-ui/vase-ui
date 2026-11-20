<script setup lang="ts">
import { useId } from 'vue';
import { OTPField } from '@vase-ui/vue/otp-field';

const OTP_LENGTH = 6;

const id = useId();
const labelId = `${id}-label`;
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
      class="flex w-full items-center gap-2"
    >
      <div class="flex gap-2">
        <OTPField.Input
          v-for="index in 3"
          :key="index"
          class="m-0 h-10 w-10 rounded-none border border-neutral-950 bg-white dark:bg-neutral-950 text-center font-inherit text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
          :aria-label="index === 1 ? undefined : `Character ${index} of ${OTP_LENGTH}`"
        />
      </div>
      <OTPField.Separator class="h-px w-4 bg-current text-neutral-950 dark:text-white" />
      <div class="flex gap-2">
        <OTPField.Input
          v-for="index in 3"
          :key="index + 3"
          class="m-0 h-10 w-10 rounded-none border border-neutral-950 bg-white dark:bg-neutral-950 text-center font-inherit text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
          :aria-label="`Character ${index + 3} of ${OTP_LENGTH}`"
        />
      </div>
    </OTPField.Root>
  </div>
</template>
