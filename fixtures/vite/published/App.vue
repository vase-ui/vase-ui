<script setup lang="ts">
import { Toggle } from '@vase-ui/vue';
import { ref, useTemplateRef, version } from 'vue';

const pressed = ref(false);
const updates = ref<boolean[]>([]);
const toggleRef = useTemplateRef('toggle');

function update(value: boolean) {
  updates.value.push(value);
  pressed.value = value;
}
</script>

<template>
  <main>
    <Toggle ref="toggle" v-slot="{ state }" :pressed="pressed" @update:pressed="update">
      {{ state.pressed ? 'On' : 'Off' }}
    </Toggle>
    <output v-if="updates.length">Vue {{ version }} emitted {{ updates.join(',') }}</output>
    <button @click="toggleRef?.element?.focus()">Focus the toggle</button>
  </main>
</template>
