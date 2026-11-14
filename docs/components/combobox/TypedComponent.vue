<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

interface User {
  id: string;
  name: string;
}

// The type arguments are `Value`, `Multiple` and `Item`.
const UserCombobox = Combobox.Root<string, false, User>;

const items = Combobox.createItems<User, string>([{ id: 'leslie', name: 'Leslie Alexander' }], {
  getValue: (user) => user.id,
  getLabel: (user) => user.name,
});

function log(value: string | null) {
  console.log(value);
}
</script>

<template>
  <UserCombobox :items="items" default-value="leslie" @value-change="log">
    <!-- ... -->
  </UserCombobox>
</template>
