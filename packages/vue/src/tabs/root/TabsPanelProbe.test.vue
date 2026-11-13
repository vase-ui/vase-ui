<script setup lang="ts">
import { onScopeDispose } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useTabsRootContext } from './TabsRootContext';

// A panel as a later part makes it: it registers with the root and with the list of the panels.
const props = defineProps<{ value: unknown; id: string }>();

const { getTabIdByPanelValue, registerPanel } = useTabsRootContext();
const { ref: listItemRef, index } = useCompositeListItem();

const registrationSource = Symbol();
registerPanel(registrationSource, { value: () => props.value, id: () => props.id });
onScopeDispose(() => registerPanel(registrationSource, undefined));
</script>

<template>
  <div
    :id="id"
    :ref="(node) => listItemRef(node as HTMLElement | null)"
    role="tabpanel"
    :aria-labelledby="getTabIdByPanelValue(value)"
    :data-index="index"
  />
</template>
