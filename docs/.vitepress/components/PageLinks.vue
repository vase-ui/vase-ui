<script setup lang="ts">
import { useData, withBase } from 'vitepress';
import type { PageGroup } from '../../../scripts/docs/navigation.ts';

const { theme } = useData<{ sidebar: PageGroup[] }>();
</script>

<template>
  <ul>
    <template v-for="group in theme.sidebar" :key="group.text">
      <li v-for="page in group.items" :key="page.link">
        <a :href="withBase(page.link)">{{ page.text }}</a>
      </li>
    </template>
  </ul>
</template>
