<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Select } from '@vase-ui/vue/select';

interface Font {
  code: string;
}

function onFontChange(value: string | null, eventDetails: Select.Root.ChangeEventDetails) {
  return value ?? eventDetails.reason;
}

function onObjectChange(value: Font | null) {
  return value?.code;
}
</script>

<template>
  <Select.Root @value-change="onFontChange" />
  <Select.Root @value-change.once="onFontChange" />
  <Select.Root @update:value="(value: string | null) => value" />
  <Select.Root @value-change="onObjectChange" />
  <Select.Root multiple @value-change="(value: string[]) => value" />
  <Select.Root @value-change="(value) => expectType<null, typeof value>(value)" />
  <Select.Root multiple @value-change="(value) => expectType<never[], typeof value>(value)" />
  <!-- @vue-expect-error The selection can be cleared, so the value can be `null`. -->
  <Select.Root @value-change="(value: string) => value" />
</template>
