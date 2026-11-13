<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
import styles from './index.module.css';
</script>

<template>
  <label :class="styles.Label">
    <Switch.Root default-checked :class="styles.Switch">
      <Switch.Thumb :class="styles.Thumb" />
    </Switch.Root>
    Notifications
  </label>
</template>
