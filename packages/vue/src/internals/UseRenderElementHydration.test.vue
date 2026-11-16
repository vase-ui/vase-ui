<script setup lang="ts">
import ServerAttributesPart from './ServerAttributesPart.test.vue';

defineProps<{
  /** Where the element of the part comes from: the tag of the part, or the `#render` slot. */
  form: 'tag' | 'slot';
  active?: boolean | undefined;
  controls?: string | undefined;
  abbreviation?: string | undefined;
  /** The `aria-label` of the consumer. */
  label?: string | undefined;
}>();
</script>

<template>
  <ServerAttributesPart
    v-if="form === 'tag'"
    data-testid="part"
    :active="active"
    :controls="controls"
    :abbreviation="abbreviation"
    :aria-label="label"
  />
  <ServerAttributesPart
    v-else
    :active="active"
    :controls="controls"
    :abbreviation="abbreviation"
    :aria-label="label"
  >
    <template #render="{ props }"><span v-bind="props" data-testid="part" /></template>
  </ServerAttributesPart>
  <p data-testid="next" />
</template>
