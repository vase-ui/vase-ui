<script setup lang="ts">
import { DateRangePicker } from '../../src/date-range-picker';
import { Popover } from '../../src/popover';
import PartForm from './PartForm.vue';

defineProps<{
  hasElementSlot: boolean;
  active: boolean;
  onPartRender: () => void;
  onInnerRender: () => void;
}>();
</script>

<template>
  <DateRangePicker.Root open>
    <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
    <Popover.Portal>
      <DateRangePicker.Positioner
        v-if="hasElementSlot"
        data-testid="positioner"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <template #element="{ props, elementRef }">
          <section v-bind="props" :ref="elementRef">
            <PartForm data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
              >Content</PartForm
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
        <PartForm data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PartForm
        >
      </DateRangePicker.Positioner>
    </Popover.Portal>
  </DateRangePicker.Root>
</template>
