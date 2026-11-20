<script setup lang="ts">
import { TimePicker } from '../../src/time-picker';
import { Popover } from '../../src/popover';
import PlainPart from './PlainPart.vue';

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
    </Popover.Portal>
  </TimePicker.Root>
</template>
