<!-- @strictTemplates true -->
<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Progress } from '@vase-ui/vue/progress';
import { Separator } from '@vase-ui/vue/separator';
import { Tabs } from '@vase-ui/vue/tabs';
import StyledDiv from './fixtures/StyledDiv.vue';
</script>

<!-- `as` takes a tag or a component. The attributes keep the types of the element of the part. -->
<template>
  <Separator as="hr" />
  <Progress.Label as="h2" />
  <Separator :as="StyledDiv" />
  <Tabs.Tab value="a" :as="RouterLink" />
  <!-- @vue-expect-error `as` takes the name of an HTML element -->
  <Separator as="not-a-tag" />
  <!-- @vue-expect-error A `<div>` has no `href`. The `element` slot takes it. -->
  <Separator as="a" href="/" />
</template>
