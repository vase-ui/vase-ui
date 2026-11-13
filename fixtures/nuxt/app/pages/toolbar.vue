<script setup lang="ts">
import { Toolbar } from '@vase-ui/vue/toolbar';
</script>

<template>
  <main>
    <Toolbar.Root data-testid="plain">
      <Toolbar.Button data-testid="plain-1">One</Toolbar.Button>
      <Toolbar.Button data-testid="plain-2">Two</Toolbar.Button>
      <Toolbar.Button data-testid="plain-3">Three</Toolbar.Button>
    </Toolbar.Root>
    <Toolbar.Root data-testid="disabled-first">
      <Toolbar.Button data-testid="disabled-first-1" disabled :focusable-when-disabled="false">
        One
      </Toolbar.Button>
      <Toolbar.Button data-testid="disabled-first-2">Two</Toolbar.Button>
      <Toolbar.Button data-testid="disabled-first-3">Three</Toolbar.Button>
    </Toolbar.Root>
    <Toolbar.Root data-testid="async">
      <AsyncSetup>
        <Toolbar.Button data-testid="async-1">One</Toolbar.Button>
      </AsyncSetup>
      <Toolbar.Button data-testid="async-2">Two</Toolbar.Button>
      <Toolbar.Button data-testid="async-3">Three</Toolbar.Button>
    </Toolbar.Root>
  </main>
</template>
