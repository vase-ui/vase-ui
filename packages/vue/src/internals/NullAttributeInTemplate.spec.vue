<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../combobox/parts';
import * as Menu from '../menu/parts';
</script>

<template>
  <Combobox.Input :autocomplete="null" />
  <Menu.Input :autocomplete="null" />
</template>
