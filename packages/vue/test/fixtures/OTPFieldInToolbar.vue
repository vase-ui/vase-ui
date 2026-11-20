<script setup lang="ts">
import { OTPField } from '../../src/otp-field';
import { Toolbar } from '../../src/toolbar';
</script>

<template>
  <Toolbar.Root>
    <OTPField.Root default-value="12" :length="3">
      <Toolbar.Button id="in-root">In the root</Toolbar.Button>
      <OTPField.Input />
      <OTPField.Input />
      <OTPField.Input />
    </OTPField.Root>
    <Toolbar.Button id="after-root">After the root</Toolbar.Button>
  </Toolbar.Root>
</template>
