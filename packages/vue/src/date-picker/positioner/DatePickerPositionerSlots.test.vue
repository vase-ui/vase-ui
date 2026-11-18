<script setup lang="ts">
import PlainPart from '../../../test/fixtures/PlainPart.vue';
import * as DatePicker from '../index.parts';

defineProps<{
  hasRenderSlot: boolean;
  active: boolean;
  onPartRender: () => undefined;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <DatePicker.Root open>
    <DatePicker.Trigger>Open</DatePicker.Trigger>
    <DatePicker.Portal>
      <DatePicker.Positioner
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
      </DatePicker.Positioner>
      <DatePicker.Positioner
        v-else
        data-testid="positioner"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <PlainPart data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PlainPart
        >
      </DatePicker.Positioner>
    </DatePicker.Portal>
  </DatePicker.Root>
</template>
