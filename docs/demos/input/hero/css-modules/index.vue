<script setup lang="ts">
import { Input } from '@vase-ui/vue/input';
import styles from './index.module.css';
</script>

<template>
  <label :class="styles.Label">
    Name
    <Input placeholder="e.g. Colm Tuite" :class="styles.Input" />
  </label>
</template>
