<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AvatarRootState {
  /**
   * The image loading status.
   */
  imageLoadingStatus: ImageLoadingStatus;
}

export interface AvatarRootProps
  extends
    VaseUIComponentProps<AvatarRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, provide, shallowRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { avatarStateAttributesMapping, AvatarRootContext } from './AvatarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AvatarRootProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: AvatarRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, AvatarRootState>;
}>();

const imageLoadingStatus = shallowRef<ImageLoadingStatus>('idle');

const state = computed<AvatarRootState>(() => ({ imageLoadingStatus: imageLoadingStatus.value }));

provide(AvatarRootContext, {
  state,
  setImageLoadingStatus(status) {
    imageLoadingStatus.value = status;
  },
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  stateAttributesMapping: avatarStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
