<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

const users = [
  { id: 'leslie', name: 'Leslie Alexander' },
  { id: 'kathryn', name: 'Kathryn Murphy' },
];

const items = Combobox.createItems(users, {
  getValue: (user) => user.id,
  getLabel: (user) => user.name,
});
</script>

<template>
  <Combobox.Root :items="items">
    <Combobox.List>
      <template #item="{ item: user }">
        <Combobox.Item :value="user.id">{{ user.name }}</Combobox.Item>
      </template>
    </Combobox.List>
  </Combobox.Root>
</template>
