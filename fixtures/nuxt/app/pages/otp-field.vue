<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { OTPField } from '@vase-ui/vue/otp-field';

const code = ref('12');
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
      <Field.Root>
        <OTPField.Root v-model:value="code" name="code" :length="4" data-testid="code">
          <OTPField.Input v-for="index in 4" :key="index" :data-testid="`code-${index}`" />
        </OTPField.Root>
        <Field.Label data-testid="code-label">Code</Field.Label>
      </Field.Root>
      <output data-testid="code-value">{{ code }}</output>
    </form>
    <label for="pin" data-testid="pin-label">PIN</label>
    <OTPField.Root id="pin" :length="4" mask default-value="56" data-testid="pin">
      <OTPField.Input v-for="index in 4" :key="index" :data-testid="`pin-${index}`" />
    </OTPField.Root>
  </main>
</template>
