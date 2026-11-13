<script setup lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';
</script>

<template>
  <main>
    <Collapsible.Root>
      <Collapsible.Trigger data-testid="closed-trigger">Closed</Collapsible.Trigger>
      <Collapsible.Panel data-testid="closed-panel">Closed panel</Collapsible.Panel>
    </Collapsible.Root>
    <Collapsible.Root default-open>
      <Collapsible.Trigger data-testid="open-trigger">Open</Collapsible.Trigger>
      <Collapsible.Panel data-testid="open-panel">Open panel</Collapsible.Panel>
    </Collapsible.Root>
    <Collapsible.Root>
      <Collapsible.Trigger data-testid="until-found-trigger">Until found</Collapsible.Trigger>
      <Collapsible.Panel data-testid="until-found-panel" hidden-until-found>
        Until found panel
      </Collapsible.Panel>
    </Collapsible.Root>
  </main>
</template>
