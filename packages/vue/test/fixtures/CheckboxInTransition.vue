<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { CheckboxGroup } from '../../src/checkbox-group';

defineProps({ scene: { type: Object as PropType<{ shown: boolean }>, required: true } });
</script>

<template>
  <Transition>
    <Checkbox v-if="scene.shown" aria-label="Box" />
  </Transition>
  <Transition>
    <CheckboxGroup v-if="scene.shown" aria-label="Group" />
  </Transition>
</template>
