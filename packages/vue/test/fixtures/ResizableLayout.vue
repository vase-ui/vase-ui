<script setup lang="ts">
import { reactive, type PropType } from 'vue';
import { Resizable } from '../../src/resizable';
import type { LayoutSpec } from '../resizable';

// A root with the parts of `spec`, in a frame. Each part has `data-key`, and a panel its key as
// its `id`. A panel can hold buttons and a root of its own, with a second level of parts.
defineProps({
  spec: { type: Object as PropType<LayoutSpec>, required: true },
  // The page of a test is 414 px wide, and a press needs a point in it.
  frame: { type: String, default: 'width: 400px; height: 100px' },
});
const panels = reactive<Record<string, unknown>>({});
defineExpose({ panels });
</script>

<template>
  <div :style="frame">
    <Resizable.Root
      v-slot="{ state, sizes }"
      data-key="root"
      style="height: 100%"
      v-bind="spec.root"
    >
      <template v-for="part in spec.parts" :key="part.key">
        <template v-if="part.show !== false">
          <Resizable.Panel
            v-if="part.kind === 'panel'"
            :id="part.key"
            :ref="(instance: unknown) => (panels[part.key] = instance)"
            v-slot="{ state: panelState }"
            :data-key="part.key"
            v-bind="part.attrs"
          >
            <button v-for="control in part.controls" :id="control" :key="control">
              {{ control }}
            </button>
            <Resizable.Root
              v-if="part.inner"
              data-key="inner-root"
              style="height: 100%"
              v-bind="part.inner.root"
            >
              <template v-for="inner in part.inner.parts" :key="inner.key">
                <Resizable.Panel
                  v-if="inner.kind === 'panel'"
                  :id="inner.key"
                  :data-key="inner.key"
                  v-bind="inner.attrs"
                >
                  <button v-for="control in inner.controls" :id="control" :key="control">
                    {{ control }}
                  </button>
                </Resizable.Panel>
                <Resizable.Handle
                  v-else-if="inner.kind === 'handle'"
                  :data-key="inner.key"
                  :aria-label="`Resize ${inner.key}`"
                  v-bind="inner.attrs"
                />
              </template>
            </Resizable.Root>
            <output class="panel-state">{{ JSON.stringify(panelState) }}</output>
          </Resizable.Panel>
          <Resizable.Handle
            v-else-if="part.kind === 'handle'"
            v-slot="{ state: handleState }"
            :data-key="part.key"
            :aria-label="`Resize ${part.key}`"
            v-bind="part.attrs"
          >
            <output class="handle-state" hidden>{{ JSON.stringify(handleState) }}</output>
          </Resizable.Handle>
          <div v-else :data-key="part.key" v-bind="part.attrs">
            <button v-for="control in part.controls" :id="control" :key="control">
              {{ control }}
            </button>
            {{ part.text }}
          </div>
        </template>
      </template>
      <output class="root-state" hidden>{{ JSON.stringify({ state, sizes }) }}</output>
    </Resizable.Root>
  </div>
</template>
