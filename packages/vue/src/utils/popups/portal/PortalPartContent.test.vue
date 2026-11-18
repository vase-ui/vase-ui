<script setup lang="ts">
import type { Component } from 'vue';
import type { GenericComponent } from '../../../internals/types';
import PlainPart from '../../../../test/fixtures/PlainPart.vue';

type PartComponent = Component | GenericComponent;

defineProps<{
  root: PartComponent;
  portal: PartComponent;
  rootProps?: Record<string, unknown>;
  portalProps?: Record<string, unknown>;
  hasRenderSlot: boolean;
  active: boolean;
  onOuterRender: () => void;
  onInnerRender: () => void;
}>();
</script>

<template>
  <component :is="root" v-bind="rootProps">
    <component :is="portal" v-if="hasRenderSlot" v-bind="portalProps">
      <template #render="{ props, children }">
        <section v-bind="props">
          <component :is="children">
            <PlainPart
              data-testid="outer"
              :active="active"
              @vue:mounted="onOuterRender"
              @vue:updated="onOuterRender"
            >
              <PlainPart
                data-testid="inner"
                @vue:mounted="onInnerRender"
                @vue:updated="onInnerRender"
                >Content</PlainPart
              >
            </PlainPart>
          </component>
        </section>
      </template>
    </component>
    <component :is="portal" v-else v-bind="portalProps">
      <PlainPart
        data-testid="outer"
        :active="active"
        @vue:mounted="onOuterRender"
        @vue:updated="onOuterRender"
      >
        <PlainPart data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PlainPart
        >
      </PlainPart>
    </component>
  </component>
</template>
