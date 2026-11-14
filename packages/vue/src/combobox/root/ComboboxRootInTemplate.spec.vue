<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Combobox } from '@vase-ui/vue/combobox';

interface User {
  id: number;
}

function onUserChange(value: User | null, eventDetails: Combobox.Root.ChangeEventDetails) {
  return value?.id ?? eventDetails.reason;
}

function onUserHighlighted(
  value: User | undefined,
  eventDetails: Combobox.Root.HighlightEventDetails,
) {
  return value?.id ?? eventDetails.reason;
}
</script>

<template>
  <Combobox.Root @value-change="onUserChange" />
  <Combobox.Root @value-change.once="onUserChange" />
  <Combobox.Root @update:value="(value: User | null) => value" />
  <Combobox.Root @item-highlighted="onUserHighlighted" />
  <Combobox.Root multiple @value-change="(value: string[]) => value" />
  <Combobox.Root @value-change="(value) => expectType<null, typeof value>(value)" />
  <Combobox.Root @item-highlighted="(value) => expectType<undefined, typeof value>(value)" />
  <!-- @vue-expect-error The selection can be cleared, so the value can be `null`. -->
  <Combobox.Root @value-change="(value: User) => value" />
</template>
