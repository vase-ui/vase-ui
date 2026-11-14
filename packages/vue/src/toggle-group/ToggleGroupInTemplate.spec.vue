<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';

type Alignment = 'left' | 'center' | 'right';

function onAlignments(value: Alignment[], eventDetails: ToggleGroup.ChangeEventDetails) {
  return value.length + eventDetails.reason.length;
}

function onWrongEventDetails(value: Alignment[], eventDetails: string) {
  return value.length + eventDetails.length;
}
</script>

<template>
  <ToggleGroup @value-change="onAlignments" />
  <ToggleGroup @value-change.once="onAlignments" />
  <ToggleGroup @update:value="(value: Alignment[]) => value" />
  <ToggleGroup @value-change="(value: string[]) => value" />
  <ToggleGroup @value-change="(value) => expectType<any[], typeof value>(value)" />
  <!-- @vue-expect-error `eventDetails` is an object -->
  <ToggleGroup @value-change="onWrongEventDetails" />
</template>
