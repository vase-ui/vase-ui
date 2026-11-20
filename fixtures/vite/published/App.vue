<script setup lang="ts">
import { Toggle } from '@vase-ui/vue';
import { ref, useTemplateRef, version } from 'vue';
import MyToggle from './MyToggle.vue';

const pressed = ref(false);
const updates = ref<boolean[]>([]);
const toggleRef = useTemplateRef('toggle');
const wrapperUpdates = ref<boolean[]>([]);

function update(value: boolean) {
  updates.value.push(value);
  pressed.value = value;
}
</script>

<template>
  <main>
    <Toggle ref="toggle" v-slot="{ state }" :model-value="pressed" @update:model-value="update">
      {{ state.pressed ? 'On' : 'Off' }}
    </Toggle>
    <output v-if="updates.length">Vue {{ version }} emitted {{ JSON.stringify(updates) }}</output>
    <button @click="toggleRef?.element?.focus()">Focus the toggle</button>
    <MyToggle v-slot="{ state }" size="sm" @update:model-value="wrapperUpdates.push($event)">
      {{ state.pressed ? 'Wrapper pressed' : 'Wrapper released' }}
    </MyToggle>
    <p id="wrapper-updates">{{ JSON.stringify(wrapperUpdates) }}</p>
  </main>
</template>
