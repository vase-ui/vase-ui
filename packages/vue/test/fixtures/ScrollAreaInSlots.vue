<script setup lang="ts">
import type { PropType } from 'vue';
import { ScrollArea } from '../../src/scroll-area';

defineProps({
  /** The scrollbar and the content render an element that has no `elementRef`. */
  unbound: Boolean,
  /**
   * Listeners of the developer that run before the listeners of the viewport and of the thumb. They
   * are in an object, because a Vapor app reads a function as a root prop as a getter.
   */
  listeners: {
    type: Object as PropType<{
      scroll?: (event: Event) => void;
      pointer?: (event: PointerEvent) => void;
    }>,
    default: () => ({}),
  },
});
</script>

<template>
  <ScrollArea.Root style="width: 200px; height: 200px">
    <template #element="{ props, elementRef, state }">
      <section v-bind="props" :ref="elementRef" class="root" :data-state="JSON.stringify(state)">
        <ScrollArea.Viewport style="width: 100%; height: 100%">
          <template
            #element="{ props: viewportProps, elementRef: viewportRef, state: viewportState }"
          >
            <article
              @scroll="listeners.scroll?.($event)"
              v-bind="viewportProps"
              :ref="viewportRef"
              class="viewport"
              :data-state="JSON.stringify(viewportState)"
            >
              <ScrollArea.Content>
                <template
                  #element="{ props: contentProps, elementRef: contentRef, state: contentState }"
                >
                  <ul
                    v-bind="contentProps"
                    :ref="unbound ? undefined : contentRef"
                    class="content"
                    style="margin: 0; padding: 0; list-style: none"
                    :data-state="JSON.stringify(contentState)"
                  >
                    <li style="width: 1000px; height: 1000px" />
                  </ul>
                </template>
              </ScrollArea.Content>
            </article>
          </template>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar style="width: 10px">
          <template #element="{ props: barProps, elementRef: barRef, state: barState }">
            <aside
              v-bind="barProps"
              :ref="unbound ? undefined : barRef"
              class="vertical"
              :data-state="JSON.stringify(barState)"
            >
              <ScrollArea.Thumb>
                <template #element="{ props: thumbProps, elementRef: thumbRef, state: thumbState }">
                  <span
                    @pointermove="listeners.pointer?.($event)"
                    @pointerup="listeners.pointer?.($event)"
                    v-bind="thumbProps"
                    :ref="thumbRef"
                    class="thumb-y"
                    style="display: block"
                    :data-state="JSON.stringify(thumbState)"
                  />
                </template>
              </ScrollArea.Thumb>
            </aside>
          </template>
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar orientation="horizontal" style="height: 10px">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner>
          <template #element="{ props: cornerProps, elementRef: cornerRef }">
            <i v-bind="cornerProps" :ref="cornerRef" class="corner" />
          </template>
        </ScrollArea.Corner>
      </section>
    </template>
  </ScrollArea.Root>
</template>
