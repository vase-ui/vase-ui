<!-- @strictTemplates true -->
<script setup lang="ts">
import { ref } from 'vue';
import { expectType } from '#test-utils';
import { Dialog } from '@vase-ui/vue/dialog';
import type { DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import type { SelectRootChangeEventDetails } from '@vase-ui/vue/select';
import WrappedDialog from './fixtures/WrappedDialog.vue';
import WrappedSelect from './fixtures/WrappedSelect.vue';

const open = ref(false);
const text = ref('');
const fruit = ref<'apple' | 'pear' | null>(null);
const handle = Dialog.createHandle<{ id: number }>();
</script>

<!-- A wrapper that types the props and the emits of a part with `@vue-ignore` gives their types to its caller. -->
<template>
  <WrappedDialog
    v-model:open="open"
    modal="trap-focus"
    :handle="handle"
    @open-change="
      (value, details) => {
        expectType<boolean, typeof value>(value);
        expectType<DialogRootChangeEventDetails, typeof details>(details);
      }
    "
    @update:open="(value) => expectType<boolean, typeof value>(value)"
  />
  <!-- @vue-expect-error `modal` takes a Boolean or `'trap-focus'`. -->
  <WrappedDialog modal="inert" />
  <!-- @vue-expect-error `v-model:open` takes a Boolean. -->
  <WrappedDialog v-model:open="text" />
  <!-- @vue-expect-error The listener of `openChange` gets a Boolean. -->
  <WrappedDialog @open-change="(value: string) => value" />
  <WrappedSelect
    v-model="fruit"
    @value-change="
      (value, details) => {
        expectType<'apple' | 'pear' | null, typeof value>(value);
        expectType<SelectRootChangeEventDetails, typeof details>(details);
      }
    "
  />
  <!-- @vue-expect-error The value of a select of fruit is a fruit. -->
  <WrappedSelect v-model="fruit" @update:model-value="(value: number) => value" />
</template>
