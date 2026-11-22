<script setup lang="ts">
import type { PropType } from 'vue';
import { Toast } from '../../src/toast';

type Props = Record<string, unknown>;

// A viewport with a toast that has each part, and a toast in a positioner with an arrow. Each part
// has `data-part` with its name. `as` gives a part a tag, and `attributes` gives it attributes. With
// `slots`, each part renders a `<section>` in its `element` slot.
const props = defineProps({
  as: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  attributes: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  slots: Boolean,
});
const toast = {
  id: 'a',
  title: 'Title',
  description: 'Description',
  actionProps: { children: 'Undo' },
};
const anchored = { id: 'b', title: 'Anchored', positionerProps: {} };
const parts: Record<string, { element: Element | null }> = {};
const setters = new Map<string, (part: unknown) => void>();
defineExpose({ parts });

function is(name: string) {
  return props.as[name] as keyof HTMLElementTagNameMap | undefined;
}

function attrs(name: string) {
  return { 'data-part': name, ...props.attributes[name] };
}

function setter(name: string) {
  let set = setters.get(name);
  if (!set) {
    set = (part) => {
      parts[name] = part as { element: Element | null };
    };
    setters.set(name, set);
  }
  return set;
}
</script>

<template>
  <Toast.Provider>
    <Toast.Viewport
      v-if="!slots"
      :as="is('Viewport')"
      v-bind="attrs('Viewport')"
      :ref="setter('Viewport')"
    >
      <Toast.Root :as="is('Root')" v-bind="attrs('Root')" :ref="setter('Root')" :toast="toast">
        <Toast.Content :as="is('Content')" v-bind="attrs('Content')" :ref="setter('Content')">
          <Toast.Title :as="is('Title')" v-bind="attrs('Title')" :ref="setter('Title')" />
          <Toast.Description
            :as="is('Description')"
            v-bind="attrs('Description')"
            :ref="setter('Description')"
          />
          <Toast.Action :as="is('Action')" v-bind="attrs('Action')" :ref="setter('Action')" />
          <Toast.Close :as="is('Close')" v-bind="attrs('Close')" :ref="setter('Close')"
            >Close</Toast.Close
          >
        </Toast.Content>
      </Toast.Root>
      <Toast.Positioner
        :as="is('Positioner')"
        v-bind="attrs('Positioner')"
        :ref="setter('Positioner')"
        :toast="anchored"
      >
        <Toast.Root :toast="anchored">
          <Toast.Arrow :as="is('Arrow')" v-bind="attrs('Arrow')" :ref="setter('Arrow')" />
        </Toast.Root>
      </Toast.Positioner>
    </Toast.Viewport>
    <Toast.Viewport v-else v-bind="attrs('Viewport')" :ref="setter('Viewport')">
      <template #element="{ props: own, elementRef }">
        <section v-bind="own" :ref="elementRef">
          <Toast.Root v-bind="attrs('Root')" :ref="setter('Root')" :toast="toast">
            <template #element="{ props: rootOwn, elementRef: rootRef }">
              <section v-bind="rootOwn" :ref="rootRef">
                <Toast.Content v-bind="attrs('Content')" :ref="setter('Content')">
                  <template #element="{ props: partOwn, elementRef: partRef }">
                    <section v-bind="partOwn" :ref="partRef">
                      <Toast.Title v-bind="attrs('Title')" :ref="setter('Title')">
                        <template #element="{ props: labelOwn, elementRef: labelRef }">
                          <section v-bind="labelOwn" :ref="labelRef">{{ toast.title }}</section>
                        </template>
                      </Toast.Title>
                      <Toast.Description v-bind="attrs('Description')" :ref="setter('Description')">
                        <template #element="{ props: labelOwn, elementRef: labelRef }">
                          <section v-bind="labelOwn" :ref="labelRef">
                            {{ toast.description }}
                          </section>
                        </template>
                      </Toast.Description>
                      <Toast.Action v-bind="attrs('Action')" :ref="setter('Action')">
                        <template #element="{ props: buttonOwn, elementRef: buttonRef }">
                          <section v-bind="buttonOwn" :ref="buttonRef">Undo</section>
                        </template>
                      </Toast.Action>
                      <Toast.Close v-bind="attrs('Close')" :ref="setter('Close')">
                        <template #element="{ props: buttonOwn, elementRef: buttonRef }">
                          <section v-bind="buttonOwn" :ref="buttonRef">Close</section>
                        </template>
                      </Toast.Close>
                    </section>
                  </template>
                </Toast.Content>
              </section>
            </template>
          </Toast.Root>
          <Toast.Positioner
            v-bind="attrs('Positioner')"
            :ref="setter('Positioner')"
            :toast="anchored"
          >
            <template #element="{ props: positionerOwn, elementRef: positionerRef }">
              <section v-bind="positionerOwn" :ref="positionerRef">
                <Toast.Root :toast="anchored">
                  <Toast.Arrow v-bind="attrs('Arrow')" :ref="setter('Arrow')">
                    <template #element="{ props: arrowOwn, elementRef: arrowRef }">
                      <section v-bind="arrowOwn" :ref="arrowRef" />
                    </template>
                  </Toast.Arrow>
                </Toast.Root>
              </section>
            </template>
          </Toast.Positioner>
        </section>
      </template>
    </Toast.Viewport>
  </Toast.Provider>
</template>
