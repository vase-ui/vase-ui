<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';

interface User {
  id: string;
  name: string;
}

const users = shallowRef<User[]>([]);

const items = computed(() =>
  Combobox.createItems(users.value, {
    getValue: (user) => user.id,
    getLabel: (user) => user.name,
  }),
);
</script>

<template>
  <Combobox.Root :items="items">
    <!-- ... -->
  </Combobox.Root>
</template>
