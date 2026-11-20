<script setup lang="ts">
import { DatePicker } from '../../src/date-picker';
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
  <DatePicker.Root open>
    <DatePicker.Trigger>Open</DatePicker.Trigger>
    <Popover.Portal>
      <DatePicker.Positioner
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
      </DatePicker.Positioner>
      <DatePicker.Positioner
        v-else
        data-testid="positioner"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <PartForm data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PartForm
        >
      </DatePicker.Positioner>
    </Popover.Portal>
  </DatePicker.Root>
</template>
