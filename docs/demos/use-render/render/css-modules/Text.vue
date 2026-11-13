<script setup lang="ts">
import type { Component } from 'vue';
import { mergeProps } from '@vase-ui/vue/merge-props';
import { useRender } from '@vase-ui/vue/use-render';
import styles from './index.module.css';

defineOptions({ inheritAttrs: false });

const props = defineProps<{ as?: string | Component | undefined }>();

const { element, elementProps, tag } = useRender(props, {
  defaultTagName: 'p',
  props: (attrs) => mergeProps<'p'>({ class: styles.Text }, attrs),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else v-bind="elementProps()"><slot /></component>
</template>
