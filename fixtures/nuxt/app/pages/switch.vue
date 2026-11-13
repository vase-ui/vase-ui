<script setup lang="ts">
import { ref } from 'vue';
import { Switch } from '@vase-ui/vue/switch';

const wifi = ref(true);
</script>

<template>
  <main>
    <form data-testid="form">
      <label data-testid="label">
        <Switch.Root data-testid="notifications" name="notifications" unchecked-value="no">
          <Switch.Thumb data-testid="thumb">Thumb</Switch.Thumb>
        </Switch.Root>
        Notifications
      </label>
      <Switch.Root v-model:checked="wifi" data-testid="wifi" name="wifi" aria-label="Wi-Fi">
        Wi-Fi
      </Switch.Root>
      <output data-testid="wifi-value">{{ wifi }}</output>
    </form>
  </main>
</template>
