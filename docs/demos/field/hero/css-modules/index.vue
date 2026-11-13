<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import styles from './index.module.css';
</script>

<template>
  <Field.Root :class="styles.Field">
    <Field.Label :class="styles.Label">Name</Field.Label>
    <Field.Control required placeholder="Required" :class="styles.Input" />

    <Field.Error :class="styles.Error" match="valueMissing">Please enter your name</Field.Error>

    <Field.Description :class="styles.Description">Visible on your profile</Field.Description>
  </Field.Root>
</template>
