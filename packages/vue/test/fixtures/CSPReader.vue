<script setup lang="ts">
import { inject } from 'vue';
import { cspKey } from '../../src/csp-provider/part';

// A part that renders a style or a script element reads the values in this way.
const csp = inject(cspKey, null);
</script>

<template>
  <output>{{
    csp ? `${csp.nonce ?? 'no nonce'} ${csp.disableStyleElements}` : 'no provider'
  }}</output>
</template>
