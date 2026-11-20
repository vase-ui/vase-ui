<script setup lang="ts">
import { TimePicker } from '../../src/time-picker';
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
  <TimePicker.Root open>
    <TimePicker.Trigger>Open</TimePicker.Trigger>
    <Popover.Portal>
      <TimePicker.Positioner
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
      </TimePicker.Positioner>
      <TimePicker.Positioner
        v-else
        data-testid="positioner"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <PartForm data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PartForm
        >
      </TimePicker.Positioner>
    </Popover.Portal>
  </TimePicker.Root>
</template>
