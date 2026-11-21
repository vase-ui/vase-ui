<script setup lang="ts">
import { ExpansionPanel } from '@vuetify/v0';
</script>

<template>
  <ExpansionPanel.Group>
    <ExpansionPanel.Root>
      <ExpansionPanel.Header>
        <ExpansionPanel.Activator>Item 1</ExpansionPanel.Activator>
      </ExpansionPanel.Header>
      <ExpansionPanel.Content>Panel 1</ExpansionPanel.Content>
    </ExpansionPanel.Root>
    <ExpansionPanel.Root>
      <ExpansionPanel.Header>
        <ExpansionPanel.Activator>Item 2</ExpansionPanel.Activator>
      </ExpansionPanel.Header>
      <ExpansionPanel.Content>Panel 2</ExpansionPanel.Content>
    </ExpansionPanel.Root>
    <ExpansionPanel.Root>
      <ExpansionPanel.Header>
        <ExpansionPanel.Activator>Item 3</ExpansionPanel.Activator>
      </ExpansionPanel.Header>
      <ExpansionPanel.Content>Panel 3</ExpansionPanel.Content>
    </ExpansionPanel.Root>
  </ExpansionPanel.Group>
</template>
