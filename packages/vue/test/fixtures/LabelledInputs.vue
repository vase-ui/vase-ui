<script setup lang="ts">
import { Input } from '../../src/input';
</script>

<template>
  <label>Name <Input /></label>
  <Input aria-label="Email" />
  <span id="phone-label">Phone</span>
  <Input aria-labelledby="phone-label" />
</template>
