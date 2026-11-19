<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { Input } from '../../src/input';

defineProps({
  root: Object as PropType<Record<string, unknown>>,
  legend: Object as PropType<Record<string, unknown>>,
});
const rootPart = useTemplateRef('rootPart');
const legendPart = useTemplateRef('legendPart');
defineExpose({ root: rootPart, legend: legendPart });
</script>

<template>
  <Fieldset.Root ref="rootPart" v-bind="root" v-slot="{ state }">
    <Fieldset.Legend ref="legendPart" v-bind="legend">Billing</Fieldset.Legend>
    <span class="state">{{ state.disabled }}</span>
    <label>Company <Input /></label>
  </Fieldset.Root>
</template>
