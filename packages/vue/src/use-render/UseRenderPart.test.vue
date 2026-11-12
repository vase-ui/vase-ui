<script lang="ts">
import type {
  UseRenderComponentProps,
  UseRenderElementProps,
  UseRenderRenderProp,
} from './useRender';

export interface UseRenderPartState {
  active: boolean;
}

export interface UseRenderPartProps
  extends
    UseRenderComponentProps<UseRenderPartState>,
    /* @vue-ignore */ UseRenderElementProps<'div'> {
  active?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useRender } from './useRender';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<UseRenderPartProps>(), { active: false });

defineSlots<{
  default(props: { state: UseRenderPartState }): unknown;
  render: UseRenderRenderProp<UseRenderPartState>;
}>();

const state = computed<UseRenderPartState>(() => ({ active: props.active }));

const { element, elementProps, tag } = useRender(props, { state });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="tag" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
