<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
import styles from './index.module.css';
</script>

<template>
  <label :class="styles.Label">
    <span :class="styles.Track">
      <Switch default-checked :class="styles.Switch" />
      <span :class="styles.Thumb" />
    </span>
    Notifications
  </label>
</template>
