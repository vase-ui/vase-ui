<script setup lang="ts">
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
</script>

<template>
  <TabsRoot default-value="1">
    <TabsList>
      <TabsIndicator />
      <TabsTrigger value="1">Tab 1</TabsTrigger>
      <TabsTrigger value="2">Tab 2</TabsTrigger>
      <TabsTrigger value="3">Tab 3</TabsTrigger>
    </TabsList>
    <TabsContent value="1">Panel 1</TabsContent>
    <TabsContent value="2">Panel 2</TabsContent>
    <TabsContent value="3">Panel 3</TabsContent>
  </TabsRoot>
</template>
