<script setup lang="ts">
import type { Component } from 'vue';
import PlainPart from '../../../../test/fixtures/PlainPart.vue';

// A generic part, such as `Dialog.Root`, is a function that `Component` does not accept.
type PartComponent = Component | ((...args: any[]) => any);

// A compiled template, as in an app. `stateClass` runs in each render of its part. The outer part
// stands for a positioner, and the inner part stands for a popup. A `v-if` on the portal, and not
// on a slot template, picks the form, so the slots of the portal stay stable.
defineProps<{
  root: PartComponent;
  portal: PartComponent;
  rootProps?: Record<string, unknown>;
  portalProps?: Record<string, unknown>;
  hasRenderSlot: boolean;
  active: boolean;
  onOuterRender: () => undefined;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <component :is="root" v-bind="rootProps">
    <component :is="portal" v-if="hasRenderSlot" v-bind="portalProps">
      <template #render="{ props, children }">
        <section v-bind="props">
          <component :is="children">
            <PlainPart data-testid="outer" :active="active" :state-class="onOuterRender">
              <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
            </PlainPart>
          </component>
        </section>
      </template>
    </component>
    <component :is="portal" v-else v-bind="portalProps">
      <PlainPart data-testid="outer" :active="active" :state-class="onOuterRender">
        <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
      </PlainPart>
    </component>
  </component>
</template>
