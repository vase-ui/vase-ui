<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';

defineProps({ scene: { type: Object as PropType<{ shown: boolean }>, required: true } });
</script>

<template>
  <Transition>
    <Fieldset.Root v-if="scene.shown">
      <Fieldset.Legend>Billing</Fieldset.Legend>
    </Fieldset.Root>
  </Transition>
</template>
