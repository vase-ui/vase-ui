<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';

const actions = ['Rename', 'Delete'];

const { contains } = Menu.useFilter();
const query = shallowRef('');
const results = computed(() => actions.filter((action) => contains(action, query.value)));
</script>

<template>
  <Menu.FilterProvider v-model:value="query" :filter="null">
    <Menu.Root>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Input aria-label="Filter actions" />
            <Menu.List>
              <Menu.Item v-for="action in results" :key="action">{{ action }}</Menu.Item>
            </Menu.List>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
</template>
