<script setup lang="ts">
import { Accordion } from '../index';

// A Boolean prop that is absent becomes `false` in Vue. `keepMounted` must stay `undefined`,
// because an explicit `false` with `hiddenUntilFound` gives a warning.
withDefaults(
  defineProps<{
    defaultValue?: number[] | undefined;
    keepMounted?: boolean | undefined;
    hiddenUntilFound?: boolean | undefined;
    triggerId?: string | undefined;
    panelId?: string | undefined;
  }>(),
  { keepMounted: undefined },
);
</script>

<template>
  <Accordion.Root
    :default-value="defaultValue"
    :keep-mounted="keepMounted"
    :hidden-until-found="hiddenUntilFound"
  >
    <Accordion.Item :value="0">
      <Accordion.Header>
        <Accordion.Trigger :id="triggerId">Trigger 1</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel :id="panelId">Panel contents 1</Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger>Trigger 2</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Panel contents 2</Accordion.Panel>
    </Accordion.Item>
  </Accordion.Root>
</template>
