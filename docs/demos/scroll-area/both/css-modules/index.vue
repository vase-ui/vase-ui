<script setup lang="ts">
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import styles from './index.module.css';
</script>

<template>
  <ScrollArea.Root :class="styles.ScrollArea">
    <ScrollArea.Viewport :class="styles.Viewport">
      <ScrollArea.Content :class="styles.Content">
        <ul :class="styles.Grid">
          <li v-for="i in 100" :key="i" :class="styles.Item">{{ i }}</li>
        </ul>
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar :class="styles.Scrollbar">
      <ScrollArea.Thumb :class="styles.Thumb" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Scrollbar :class="styles.Scrollbar" orientation="horizontal">
      <ScrollArea.Thumb :class="styles.Thumb" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner />
  </ScrollArea.Root>
</template>
