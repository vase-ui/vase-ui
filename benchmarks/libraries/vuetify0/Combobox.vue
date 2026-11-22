<script setup lang="ts">
import { Combobox } from '@vuetify/v0';
import { options } from '../../harness/options.ts';
</script>

<template>
  <Combobox.Root>
    <Combobox.Activator>
      <Combobox.Control placeholder="Label" data-bench="input" />
      <Combobox.Cue data-bench="trigger">Open</Combobox.Cue>
    </Combobox.Activator>
    <Combobox.Content data-bench="popup">
      <Combobox.Item v-for="option in options" :key="option" :value="option">
        {{ option }}
      </Combobox.Item>
      <Combobox.Empty>No results</Combobox.Empty>
    </Combobox.Content>
  </Combobox.Root>
</template>
