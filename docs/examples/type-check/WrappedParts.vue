<script setup lang="ts">
// The type check of this file fails when a wrapper of the composition guide loses the types of the
// props, the models or the events of its part.
import { ref } from 'vue';
import type { DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import type { SelectRootChangeEventDetails } from '@vase-ui/vue/select';
import MyDialog from '../composition/MyDialog.vue';
import MySelect from '../composition/MySelect.vue';

const open = ref(false);
const fruit = ref<'apple' | 'pear' | null>(null);
const fruits = ref<('apple' | 'pear')[]>([]);

function onOpenChange(value: boolean, details: DialogRootChangeEventDetails) {
  return [value, details.reason];
}

function onValueChange(value: 'apple' | 'pear' | null, details: SelectRootChangeEventDetails) {
  return [value, details.reason];
}
</script>

<template>
  <MyDialog v-model:open="open" modal="trap-focus" @open-change="onOpenChange" />
  <!-- @vue-expect-error `modal` takes a Boolean or `'trap-focus'`. -->
  <MyDialog modal="inert" />
  <!-- @vue-expect-error `v-model:open` takes a Boolean. -->
  <MyDialog v-model:open="fruit" />
  <!-- @vue-expect-error The listener of `openChange` gets a Boolean. -->
  <MyDialog @open-change="(value: string) => value" />
  <!-- @vue-expect-error The dialog has no `openChanged` event. -->
  <MyDialog @open-changed="onOpenChange" />
  <MySelect v-model="fruit" @value-change="onValueChange" />
  <MySelect v-model="fruits" multiple />
  <!-- @vue-expect-error With `multiple`, the value is an array. -->
  <MySelect v-model="fruit" multiple />
  <!-- @vue-expect-error The listener gets a fruit, not a number. -->
  <MySelect v-model="fruit" @update:model-value="(value: number) => value" />
</template>
