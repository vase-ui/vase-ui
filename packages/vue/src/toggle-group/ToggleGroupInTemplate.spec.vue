<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { ref } from 'vue';
import { Toggle, type ToggleState } from '@vase-ui/vue/toggle';
import { ToggleGroup, type ToggleGroupState } from '@vase-ui/vue/toggle-group';

type Alignment = 'left' | 'center' | 'right';

// A ref that a store or a cookie empties with `null`.
const alignments = ref<Alignment[] | null>(null);

function onAlignments(value: Alignment[], eventDetails: ToggleGroup.ChangeEventDetails) {
  return value.length + eventDetails.reason.length;
}

function onWrongEventDetails(value: Alignment[], eventDetails: string) {
  return value.length + eventDetails.length;
}
</script>

<template>
  <ToggleGroup @value-change="onAlignments" />
  <ToggleGroup v-model="alignments" />
  <ToggleGroup @value-change.once="onAlignments" />
  <ToggleGroup @update:model-value="(value: Alignment[]) => value" />
  <ToggleGroup @value-change="(value: string[]) => value" />
  <ToggleGroup @value-change="(value) => expectType<any[], typeof value>(value)" />
  <!-- @vue-expect-error `eventDetails` is an object -->
  <ToggleGroup @value-change="onWrongEventDetails" />
  <ToggleGroup as="section" v-slot="{ state }">
    <span @click="expectType<ToggleGroupState, typeof state>(state)" />
  </ToggleGroup>

  <!-- A toggle takes the native attributes of a button, and its slots give the state. -->
  <Toggle
    type="submit"
    aria-label="Bold"
    @pressed-change="(pressed, details) => details.cancel()"
  />
  <Toggle as="span" v-slot="{ state }">
    <span @click="expectType<ToggleState, typeof state>(state)">Bold</span>
  </Toggle>
  <Toggle>
    <template #element="{ props, elementRef, state }">
      <span
        v-bind="props"
        :ref="elementRef"
        @click="
          () => {
            expectType<ToggleState, typeof state>(state);
            expectType<(target: unknown) => void, typeof elementRef>(elementRef);
            expectType<Record<string, unknown>, typeof props>(props);
          }
        "
      >
        Bold
      </span>
    </template>
  </Toggle>
  <!-- @vue-expect-error `defaultPressed` is a Boolean -->
  <Toggle default-pressed="yes" />
</template>
