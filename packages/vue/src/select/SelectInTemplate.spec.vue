<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { shallowRef } from 'vue';
import { Select } from '@vase-ui/vue/select';

const font = shallowRef<string | null>('mono');
const fonts = shallowRef<string[]>([]);

function onFontChange(value: string | null, details: Select.Root.ChangeEventDetails) {
  return value ?? details.reason;
}
</script>

<template>
  <Select.Root v-model="font" @value-change="onFontChange">
    <Select.Trigger disabled focusable-when-disabled />
    <!-- @vue-expect-error `focusableWhenDisabled` is a Boolean. -->
    <Select.Trigger focusable-when-disabled="yes" />
    <Select.Value v-slot="{ state }">
      <span v-if="expectType<boolean, typeof state.placeholder>(state.placeholder) === undefined" />
    </Select.Value>
  </Select.Root>
  <Select.Root v-model="fonts" multiple @value-change="(value: string[]) => value" />
  <Select.Root @value-change="(value) => expectType<null, typeof value>(value)" />
  <!-- @vue-expect-error The selection can be cleared, so the value can be `null`. -->
  <Select.Root @value-change="(value: string) => value" />
</template>
