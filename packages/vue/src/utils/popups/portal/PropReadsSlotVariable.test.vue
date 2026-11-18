<script setup lang="ts">
import PlainPart from '../../../../test/fixtures/PlainPart.vue';

// A prop of the middle part reads a slot variable, as `<component :is="children">` does in a
// `#render` slot.
defineProps<{
  active: boolean;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <PlainPart>
    <template #default="{ state }">
      <PlainPart :orientation="state.orientation" :active="active">
        <PlainPart @vue:mounted="onInnerRender" @vue:updated="onInnerRender">Content</PlainPart>
      </PlainPart>
    </template>
  </PlainPart>
</template>
