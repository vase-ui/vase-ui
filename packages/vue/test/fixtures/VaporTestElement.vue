<script setup vapor lang="ts">
import { useTemplateRef } from 'vue';
import type { SetupElement } from '../testElement';

const props = defineProps<{ setupElement: SetupElement }>();
const element = useTemplateRef<HTMLDivElement>('element');
const bindings = props.setupElement(element) ?? {};
</script>

<template>
  <div ref="element" v-bind="bindings" />
</template>
