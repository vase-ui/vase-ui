<script setup lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';
</script>

<template>
  <Collapsible.Root data-testid="root">
    <template #render="{ props, state }">
      <div
        v-bind="props"
        :ref="props.ref"
        :class="state.open ? 'root-open' : 'root-closed'"
        :style="{ opacity: state.open ? 1 : 0.5 }"
      >
        <Collapsible.Trigger>
          <template #render="{ props: trigger, state: triggerState }">
            <button
              v-bind="trigger"
              :ref="trigger.ref"
              :class="triggerState.open ? 'trigger-open' : 'trigger-closed'"
              :style="{ opacity: triggerState.open ? 1 : 0.5 }"
            >
              Trigger
            </button>
          </template>
        </Collapsible.Trigger>
        <Collapsible.Panel keep-mounted data-testid="panel">
          <template #render="{ props: panel, state: panelState }">
            <div
              v-bind="panel"
              :ref="panel.ref"
              :class="panelState.open ? 'panel-open' : 'panel-closed'"
              :style="{ opacity: panelState.open ? 1 : 0.5 }"
            >
              Content
            </div>
          </template>
        </Collapsible.Panel>
      </div>
    </template>
  </Collapsible.Root>
</template>
