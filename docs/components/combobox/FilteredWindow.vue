<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';

interface User {
  id: string;
  name: string;
}

const knownUsers = shallowRef<User[]>([]);
const searchResults = shallowRef<User[]>([]);
const selectedUserId = shallowRef<string | null>(null);

const items = computed(() =>
  Combobox.createItems(knownUsers.value, {
    getValue: (user) => user.id,
    getLabel: (user) => user.name,
  }),
);
</script>

<template>
  <Combobox.Root v-model:value="selectedUserId" :items="items" :filtered-items="searchResults">
    <!-- ... -->
  </Combobox.Root>
</template>
