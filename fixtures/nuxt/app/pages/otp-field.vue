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
        <OTPField.Root v-model="code" name="code" :length="4" data-testid="code">
          <OTPField.Input v-for="index in 4" :key="index" :data-testid="`code-${index}`" />
        </OTPField.Root>
        <Field.Label data-testid="code-label">Code</Field.Label>
      </Field.Root>
      <output data-testid="code-value">{{ code }}</output>
    </form>
    <label id="pin-label" for="pin" data-testid="pin-label">PIN</label>
    <OTPField.Root
      id="pin"
      :length="4"
      default-value="56"
      aria-labelledby="pin-label"
      data-testid="pin"
    >
      <OTPField.Input
        v-for="index in 4"
        :key="index"
        type="password"
        :data-testid="`pin-${index}`"
      />
    </OTPField.Root>
  </main>
</template>
