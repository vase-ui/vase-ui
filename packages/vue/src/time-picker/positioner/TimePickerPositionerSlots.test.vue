<script setup lang="ts">
import PlainPart from '../../../test/fixtures/PlainPart.vue';
import * as TimePicker from '../index.parts';

defineProps<{
  hasRenderSlot: boolean;
  active: boolean;
  onPartRender: () => undefined;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <TimePicker.Root open>
    <TimePicker.Trigger>Open</TimePicker.Trigger>
    <TimePicker.Portal>
      <TimePicker.Positioner
        v-if="hasRenderSlot"
        data-testid="positioner"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <template #render="{ props }">
          <section v-bind="props">
            <PlainPart data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
              >Content</PlainPart
            >
          </section>
        </template>
      </TimePicker.Positioner>
      <TimePicker.Positioner
        v-else
        data-testid="positioner"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <PlainPart data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PlainPart
        >
      </TimePicker.Positioner>
    </TimePicker.Portal>
  </TimePicker.Root>
</template>
