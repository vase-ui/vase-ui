<script setup lang="ts">
import { Toolbar } from '@vase-ui/vue/toolbar';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
</script>

<template>
  <Toolbar.Root>
    <ToggleGroup aria-label="Alignment">
      <Toolbar.Button :as="Toggle" aria-label="Align left" value="align-left">
        Align Left
      </Toolbar.Button>
      <Toolbar.Button :as="Toggle" aria-label="Align right" value="align-right">
        Align Right
      </Toolbar.Button>
    </ToggleGroup>
  </Toolbar.Root>
</template>
