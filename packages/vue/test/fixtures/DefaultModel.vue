<script setup lang="ts">
import { ref } from 'vue';
import { Switch } from '@vase-ui/vue/switch';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';

const formats = ref(['bold']);
const italic = ref(false);
const notifications = ref(true);
</script>

<template>
  <form>
    <ToggleGroup v-model="formats" multiple>
      <Toggle value="bold">Bold</Toggle>
      <Toggle v-model="italic" value="italic">Italic</Toggle>
    </ToggleGroup>
    <label>
      <Switch v-model="notifications" name="notifications" value="email" />
      Email
    </label>
    <output>{{ formats.join(',') }} / {{ italic }} / {{ notifications }}</output>
  </form>
</template>
