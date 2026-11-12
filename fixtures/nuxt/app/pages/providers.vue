<script setup lang="ts">
import { Button } from '@vase-ui/vue/button';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
</script>

<template>
  <main>
    <DirectionText data-testid="outside" />
    <div data-testid="providers">
      <DirectionProvider direction="rtl">
        <CSPProvider nonce="test-nonce">
          <DirectionText data-testid="inside" />
          <Button data-testid="button">Button</Button>
        </CSPProvider>
      </DirectionProvider>
    </div>
  </main>
</template>
