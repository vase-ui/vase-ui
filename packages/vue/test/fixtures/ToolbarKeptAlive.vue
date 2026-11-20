<script setup lang="ts">
import type { PropType } from 'vue';
import { Toolbar } from '../../src/toolbar';

// Two groups of items in `KeepAlive`, between the buttons `first` and `last`.
defineProps({
  scene: { type: Object as PropType<{ branch: 'a' | 'b' }>, required: true },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Toolbar.Root>
    <Toolbar.Button id="first">First</Toolbar.Button>
    <KeepAlive>
      <Toolbar.Group v-if="scene.branch === 'a'" key="a">
        <Toolbar.Button id="a1">A1</Toolbar.Button>
        <Toolbar.Button id="a2">A2</Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Group v-else key="b">
        <Toolbar.Button id="b1">B1</Toolbar.Button>
        <Toolbar.Button id="b2">B2</Toolbar.Button>
      </Toolbar.Group>
    </KeepAlive>
    <Toolbar.Button id="last">Last</Toolbar.Button>
  </Toolbar.Root>
  <input id="after" aria-label="After" />
</template>
