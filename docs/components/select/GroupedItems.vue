<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';

const groups = [
  {
    value: 'Fruits',
    items: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
    ],
  },
  {
    value: 'Vegetables',
    items: [
      { value: 'carrot', label: 'Carrot' },
      { value: 'spinach', label: 'Spinach' },
    ],
  },
];
</script>

<template>
  <Select.Root :items="groups" />
</template>
