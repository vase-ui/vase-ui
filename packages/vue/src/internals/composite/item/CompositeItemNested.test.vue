<script setup lang="ts">
import CompositeItemPart from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeRootPart from '../../../../test/fixtures/CompositeRootPart.vue';
import CompositeItemTabStop from './CompositeItemTabStop.test.vue';
</script>

<template>
  <CompositeRootPart data-testid="outer">
    <CompositeItemPart data-testid="first" />
    <span tabindex="0" data-testid="plain" />
    <CompositeItemTabStop has-active-item :active="['b']" late />
    <CompositeItemPart data-testid="last" />
  </CompositeRootPart>
</template>
