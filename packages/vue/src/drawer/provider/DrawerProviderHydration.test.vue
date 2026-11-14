<script setup lang="ts">
import * as Drawer from '../index.parts';
</script>

<template>
  <Drawer.Provider>
    <Drawer.IndentBackground data-testid="background" />
    <Drawer.Indent data-testid="indent">
      <Drawer.Root default-open />
    </Drawer.Indent>
  </Drawer.Provider>
</template>
