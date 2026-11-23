<script setup lang="ts">
import { Select } from '@vuetify/v0';
import { ref } from 'vue';
import { options } from '../../../harness/options.ts';
import '../../../behavior/style.css';

const value = ref<string | string[] | undefined>('Option 1');
</script>

<template>
  <div class="bench-page">
    <Select.Root v-model="value">
      <Select.Activator label="Label" data-bench="trigger">
        <Select.Value />
      </Select.Activator>
      <Select.Content data-bench="popup">
        <Select.Item v-for="option in options" :key="option" :value="option">
          {{ option }}
        </Select.Item>
      </Select.Content>
    </Select.Root>
  </div>
</template>
