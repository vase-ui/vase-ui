<script lang="ts">
import type {
  UseRenderComponentProps,
  UseRenderElementProps,
  UseRenderRenderProp,
} from '@vase-ui/vue/use-render';

export interface NoticeState {
  tone: 'info' | 'warning';
}

export interface NoticeProps
  extends UseRenderComponentProps<NoticeState>, /* @vue-ignore */ UseRenderElementProps<'p'> {
  tone?: NoticeState['tone'] | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useRender } from '@vase-ui/vue/use-render';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NoticeProps>(), { tone: 'info' });

defineSlots<{
  default(props: { state: NoticeState }): unknown;
  render: UseRenderRenderProp<NoticeState>;
}>();

const state = computed<NoticeState>(() => ({ tone: props.tone }));

const { element, elementProps, tag } = useRender(props, {
  state,
  defaultTagName: 'p',
  props: (attrs) => [{ role: 'note' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="tag" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
