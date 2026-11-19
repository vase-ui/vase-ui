<script setup lang="ts">
import type { PropType } from 'vue';
import { Avatar } from '../../src/avatar';
import ExposedImage from './ExposedImage.vue';

defineProps({
  kind: {
    type: String as PropType<'own-source' | 'keyed' | 'component' | 'no-element'>,
    required: true,
  },
  scene: { type: Object as PropType<{ picture: string }>, required: true },
  image: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Avatar.Root>
    <template #element="{ props, elementRef, state }">
      <div v-bind="props" :ref="elementRef" class="Root" :data-status="state.imageLoadingStatus">
        <Avatar.Image v-bind="image">
          <template #element="{ props: imageProps, elementRef: imageRef, state: imageState }">
            <img
              v-if="kind === 'own-source'"
              :src="scene.picture"
              v-bind="imageProps"
              :ref="imageRef"
              :data-status="imageState.imageLoadingStatus"
            />
            <img
              v-else-if="kind === 'keyed'"
              :key="scene.picture"
              v-bind="imageProps"
              :ref="imageRef"
              alt=""
              :src="scene.picture"
            />
            <ExposedImage
              v-else-if="kind === 'component'"
              v-bind="imageProps"
              :ref="imageRef"
              :picture="scene.picture"
            />
            <ExposedImage v-else v-bind="imageProps" :picture="scene.picture" />
          </template>
        </Avatar.Image>
        <Avatar.Fallback>
          <template
            #element="{ props: fallbackProps, elementRef: fallbackRef, state: fallbackState }"
          >
            <i v-bind="fallbackProps" :ref="fallbackRef" class="Fallback">{{
              fallbackState.imageLoadingStatus
            }}</i>
          </template>
        </Avatar.Fallback>
      </div>
    </template>
  </Avatar.Root>
</template>
