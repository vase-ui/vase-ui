<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
</script>

<template>
  <main>
    <Accordion.Root :default-value="['open']">
      <Accordion.Item value="closed">
        <Accordion.Header>
          <Accordion.Trigger data-testid="closed-trigger">Closed</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel data-testid="closed-panel">Closed panel</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="open">
        <Accordion.Header data-testid="open-header">
          <Accordion.Trigger data-testid="open-trigger">Open</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel data-testid="open-panel">Open panel</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item>
        <Accordion.Header>
          <Accordion.Trigger data-testid="until-found-trigger">Until found</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel data-testid="until-found-panel" hidden-until-found>
          Until found panel
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  </main>
</template>
