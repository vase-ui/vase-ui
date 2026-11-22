<script setup lang="ts">
import { Select } from '@vuetify/v0';
import { options } from '../../harness/options.ts';
</script>

<template>
  <Select.Root>
    <Select.Activator label="Label" data-bench="trigger">
      <Select.Value />
    </Select.Activator>
    <Select.Content data-bench="popup">
      <Select.Item v-for="option in options" :key="option" :value="option">
        {{ option }}
      </Select.Item>
    </Select.Content>
  </Select.Root>
</template>
