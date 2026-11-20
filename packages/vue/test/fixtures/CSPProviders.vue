<script setup lang="ts">
import type { PropType } from 'vue';
import { CSPProvider, type CSPProviderProps } from '../../src/csp-provider';
import CSPReader from './CSPReader.vue';

// A reader outside each provider, a reader in `outer`, and with `inner` a reader in a provider in
// `outer`.
defineProps({
  outer: { type: Object as PropType<CSPProviderProps>, default: () => ({}) },
  inner: Object as PropType<CSPProviderProps>,
});
</script>

<template>
  <div class="Ancestor">
    <CSPReader id="none" />
    <CSPProvider v-bind="outer">
      <CSPReader id="outer" />
      <CSPProvider v-if="inner" v-bind="inner">
        <CSPReader id="inner" />
      </CSPProvider>
    </CSPProvider>
  </div>
</template>
