<script setup lang="ts">
import PlainPart from '../../../test/fixtures/PlainPart.vue';
import * as DatePicker from '../index.parts';

// A compiled template, as in an app. `stateClass` runs in each render of its part. The inner part
// stands for the popup. A `v-if` on the positioner, and not on a slot template, picks the form.
defineProps<{
  hasRenderSlot: boolean;
  active: boolean;
  onPartRender: () => undefined;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <DatePicker.Root open>
    <DatePicker.Portal>
      <DatePicker.Positioner
        v-if="hasRenderSlot"
        data-testid="positioner"
        :data-active="active"
        :state-class="onPartRender"
      >
        <template #render="{ props }">
          <section v-bind="props">
            <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
          </section>
        </template>
      </DatePicker.Positioner>
      <DatePicker.Positioner
        v-else
        data-testid="positioner"
        :data-active="active"
        :state-class="onPartRender"
      >
        <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
      </DatePicker.Positioner>
    </DatePicker.Portal>
  </DatePicker.Root>
</template>
