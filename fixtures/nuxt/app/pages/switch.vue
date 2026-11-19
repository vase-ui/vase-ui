<script setup lang="ts">
import { ref } from 'vue';
import { Switch } from '@vase-ui/vue/switch';

const wifi = ref(true);
</script>

<template>
  <main>
    <form data-testid="form">
      <label data-testid="label">
        <Switch data-testid="notifications" name="notifications" unchecked-value="no" />
        Notifications
      </label>
      <Switch v-model="wifi" data-testid="wifi" name="wifi" aria-label="Wi-Fi" />
      <output data-testid="wifi-value">{{ wifi }}</output>
    </form>
  </main>
</template>
