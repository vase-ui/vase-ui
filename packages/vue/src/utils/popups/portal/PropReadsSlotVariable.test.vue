<script setup lang="ts">
import PlainPart from '../../../../test/fixtures/PlainPart.vue';

// A prop of the middle part reads a slot variable, as `<component :is="children">` does in a
// `#render` slot. `stateClass` runs in each render of its part.
defineProps<{
  active: boolean;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <PlainPart>
    <template #default="{ state }">
      <PlainPart :orientation="state.orientation" :active="active">
        <PlainPart :state-class="onInnerRender">Content</PlainPart>
      </PlainPart>
    </template>
  </PlainPart>
</template>
