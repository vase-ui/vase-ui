<script setup lang="ts">
import { shallowReactive, shallowRef, useTemplateRef, type PropType } from 'vue';
import { Toggle } from '../../src/toggle';
import LateElement from './LateElement.vue';
import PartForm from './PartForm.vue';
import StyledButton from './StyledButton.vue';

type Scene = 'default' | 'link' | 'component' | 'toggle' | 'in-toggle' | 'late' | 'list';

// `PartForm` in each form of its element, while `view.shown`. `mine` is the target that a function
// ref of the developer gets beside `elementRef`. With `list`, each key of `keys` renders a `PartForm`, and
// `parts` holds the exposed values of each key.
const props = defineProps({
  scene: { type: String as PropType<Scene>, required: true },
  view: { type: Object as PropType<{ shown: boolean }>, default: () => ({ shown: true }) },
  keys: { type: Array as PropType<string[]>, default: () => [] },
  ready: { type: Promise as PropType<Promise<void>>, default: () => Promise.resolve() },
  log: Function as PropType<(entry: string) => void>,
});
const part = useTemplateRef<{ element: Element | null }>('part');
const toggle = useTemplateRef<{ element: Element | null }>('toggle');
const mine = shallowRef<unknown>(null);
const parts = shallowReactive(new Map<string, { element: Element | null }>());
function keep(key: string, exposed: unknown) {
  if (exposed) parts.set(key, exposed as { element: Element | null });
}
const log = (entry: string) => props.log?.(entry);
defineExpose({ part, toggle, mine, parts });
</script>

<template>
  <div class="Ancestor">
    <template v-if="view.shown">
      <PartForm v-if="scene === 'default'" ref="part" tone="warning" data-testid="notice">
        Text
      </PartForm>
      <PartForm v-else-if="scene === 'link'" ref="part">
        <template #element="{ props: elementProps, elementRef }">
          <a
            v-bind="elementProps"
            :ref="
              (target) => {
                elementRef(target);
                mine = target;
              }
            "
            href="#notice"
            >Link</a
          >
        </template>
      </PartForm>
      <PartForm v-else-if="scene === 'component'" ref="part">
        <template #element="{ props: elementProps, elementRef }">
          <StyledButton v-bind="elementProps" :ref="elementRef">Styled</StyledButton>
        </template>
      </PartForm>
      <PartForm v-else-if="scene === 'toggle'" ref="part" @click="log('notice click')">
        <template #element="{ props: elementProps, elementRef }">
          <Toggle
            v-bind="elementProps"
            :ref="elementRef"
            @click="log('toggle click')"
            @pressed-change="log('pressedChange')"
          >
            Bold
          </Toggle>
        </template>
      </PartForm>
      <Toggle
        v-else-if="scene === 'in-toggle'"
        ref="toggle"
        @click="log('toggle click')"
        @pressed-change="log('pressedChange')"
      >
        <template #element="{ props: elementProps, elementRef }">
          <PartForm
            v-bind="elementProps"
            :ref="
              (target) => {
                elementRef(target);
                mine = target;
              }
            "
            @click="log('notice click')"
          >
            Bold
          </PartForm>
        </template>
      </Toggle>
      <PartForm v-else-if="scene === 'late'" ref="part">
        <template #element="{ props: elementProps, elementRef }">
          <LateElement v-bind="elementProps" :ref="elementRef" :ready="ready">Late</LateElement>
        </template>
      </PartForm>
      <template v-else>
        <PartForm
          v-for="key in keys"
          :key="key"
          :ref="(exposed) => keep(key, exposed)"
          :data-key="key"
        >
          {{ key }}
        </PartForm>
      </template>
    </template>
  </div>
</template>
