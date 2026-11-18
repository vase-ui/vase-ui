<script setup lang="ts">
import PlainPart from '../../../test/fixtures/PlainPart.vue';
import * as DateRangePicker from '../index.parts';

defineProps<{
  hasRenderSlot: boolean;
  active: boolean;
  onPartRender: () => void;
  onInnerRender: () => void;
}>();
</script>

<template>
  <DateRangePicker.Root open>
    <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
    <DateRangePicker.Portal>
      <DateRangePicker.Positioner
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
      </DateRangePicker.Positioner>
      <DateRangePicker.Positioner
        v-else
        data-testid="positioner"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <PlainPart data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PlainPart
        >
      </DateRangePicker.Positioner>
    </DateRangePicker.Portal>
  </DateRangePicker.Root>
</template>
