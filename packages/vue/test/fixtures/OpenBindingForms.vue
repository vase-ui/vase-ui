<script lang="ts">
export type OpenBindingFormsPart = 'plain' | 'generic';

/** The ways in which a template gives the `open` and `defaultOpen` props to a part. */
export type OpenBindingForm =
  | 'absent'
  | 'undefined binding'
  | 'camel case'
  | 'kebab case'
  | 'false binding'
  | 'bare attribute'
  | 'v-model';
</script>

<script setup lang="ts">
import { computed, ref } from 'vue';
import GenericOpenPart from './GenericOpenPart.vue';
import OpenPart from './OpenPart.vue';

const props = defineProps<{ part: OpenBindingFormsPart; form: OpenBindingForm }>();

const Part = computed(() => (props.part === 'plain' ? OpenPart : GenericOpenPart));
const model = ref(false);

defineExpose({ model });
</script>

<template>
  <component :is="Part" v-if="form === 'absent'" />
  <component :is="Part" v-else-if="form === 'undefined binding'" :open="undefined" />
  <component :is="Part" v-else-if="form === 'camel case'" :defaultOpen="true" />
  <component :is="Part" v-else-if="form === 'kebab case'" :default-open="true" />
  <component :is="Part" v-else-if="form === 'false binding'" :open="false" />
  <component :is="Part" v-else-if="form === 'bare attribute'" open />
  <component :is="Part" v-else v-model:open="model" />
</template>
