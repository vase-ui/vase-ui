<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../src/combobox/parts';
import * as Menu from '../src/menu/parts';
</script>

<template>
  <Combobox.Input :autocomplete="null" />
  <Menu.Input :autocomplete="null" />
</template>
