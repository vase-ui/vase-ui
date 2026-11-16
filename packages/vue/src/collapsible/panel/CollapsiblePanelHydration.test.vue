<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Collapsible } from '../index';

// A Boolean prop that is absent becomes `false` in Vue. `keepMounted` must stay `undefined`,
// because an explicit `false` with `hiddenUntilFound` gives a warning.
withDefaults(
  defineProps<{
    defaultOpen?: boolean | undefined;
    keepMounted?: boolean | undefined;
    hiddenUntilFound?: boolean | undefined;
    panelId?: string | undefined;
    panelClass?: string | undefined;
    panelBefore?: boolean | undefined;
    laterRemovedAtMount?: boolean | undefined;
  }>(),
  { defaultOpen: undefined, keepMounted: undefined, hiddenUntilFound: undefined },
);

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Collapsible.Root :default-open="defaultOpen">
    <Collapsible.Panel v-if="panelBefore" id="panel-0">Panel 0 content</Collapsible.Panel>
    <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
    <Collapsible.Panel
      v-if="!(laterRemovedAtMount && isMounted)"
      :id="panelId"
      :class="panelClass"
      :keep-mounted="keepMounted"
      :hidden-until-found="hiddenUntilFound"
      data-testid="panel"
    >
      Panel content
    </Collapsible.Panel>
  </Collapsible.Root>
</template>

<style>
@keyframes collapsible-hydration-slide-down {
  from {
    height: 0;
  }

  to {
    height: var(--collapsible-panel-height);
  }
}

.collapsible-hydration-animation-panel[data-open] {
  overflow: hidden;
  animation: collapsible-hydration-slide-down 100ms linear;
}
</style>
