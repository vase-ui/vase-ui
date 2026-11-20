<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { NavigationMenu } from '../../src/navigation-menu';

type Props = Record<string, unknown>;

// A horizontal list of two items with a content, and an item with a link. Text inputs stand before
// and after the root, and a button at the bottom right of the view is outside. The content of `one`
// is 200 px by 100 px, and that of `two` is 300 px by 150 px. With `inline`, the viewport is in
// place after the list, and the root has no portal.
defineProps({
  root: Object as PropType<Props>,
  list: Object as PropType<Props>,
  triggers: Object as PropType<Record<string, Props>>,
  contents: Object as PropType<Record<string, Props>>,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  viewport: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  arrow: Object as PropType<Props>,
  /** The props of a `<Transition>` around the popup. */
  popupTransition: Object as PropType<Props>,
  inline: Boolean,
  /** The portal is in the root while its value is `true`. */
  withPortal: { type: Object as PropType<{ shown: boolean }>, default: () => ({ shown: true }) },
  /** The item `one` is in the list while its value is `true`. */
  items: { type: Object as PropType<{ one: boolean }>, default: () => ({ one: true }) },
  noViewport: Boolean,
  /** The content of `one` holds this many more links. */
  moreLinks: { type: Number, default: 0 },
  /** A nested root in the content of `one`, in place unless `inline` is `false`. */
  nested: Object as PropType<{ root?: Props; inline?: boolean; contents?: Record<string, Props> }>,
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });
</script>

<template>
  <input id="before" aria-label="Before" />
  <NavigationMenu.Root ref="rootPart" data-testid="root" v-bind="root">
    <NavigationMenu.List
      data-testid="list"
      style="display: flex; gap: 8px; margin: 0; padding: 0; list-style: none"
      v-bind="list"
    >
      <NavigationMenu.Item v-if="items.one" value="one">
        <NavigationMenu.Trigger data-testid="trigger-one" v-bind="triggers?.one">
          One <NavigationMenu.Icon data-testid="icon-one" />
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          data-testid="content-one"
          style="width: 200px; height: 100px"
          v-bind="contents?.one"
        >
          <NavigationMenu.Link href="#one-a" data-testid="link-one-a">One A</NavigationMenu.Link>
          <NavigationMenu.Link href="#one-b" data-testid="link-one-b">One B</NavigationMenu.Link>
          <NavigationMenu.Link
            v-for="index in moreLinks"
            :key="index"
            :href="`#one-${index}`"
            class="more"
          >
            More {{ index }}
          </NavigationMenu.Link>
          <NavigationMenu.Root v-if="nested" data-testid="nested-root" v-bind="nested.root">
            <NavigationMenu.List data-testid="nested-list">
              <NavigationMenu.Item value="sub-a">
                <NavigationMenu.Trigger data-testid="trigger-sub-a">Sub A</NavigationMenu.Trigger>
                <NavigationMenu.Content
                  data-testid="content-sub-a"
                  style="width: 150px; height: 60px"
                  v-bind="nested.contents?.a"
                >
                  <NavigationMenu.Link href="#sub-a" data-testid="link-sub-a" close-on-click>
                    Sub A link
                  </NavigationMenu.Link>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
              <NavigationMenu.Item value="sub-b">
                <NavigationMenu.Trigger data-testid="trigger-sub-b">Sub B</NavigationMenu.Trigger>
                <NavigationMenu.Content
                  data-testid="content-sub-b"
                  style="width: 150px; height: 120px"
                  v-bind="nested.contents?.b"
                >
                  <NavigationMenu.Link href="#sub-b" data-testid="link-sub-b">
                    Sub B link
                  </NavigationMenu.Link>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>
            <NavigationMenu.Viewport v-if="nested.inline !== false" data-testid="nested-viewport" />
            <NavigationMenu.Portal v-else>
              <NavigationMenu.Positioner data-testid="nested-positioner" side="right">
                <NavigationMenu.Popup data-testid="nested-popup">
                  <NavigationMenu.Viewport />
                </NavigationMenu.Popup>
              </NavigationMenu.Positioner>
            </NavigationMenu.Portal>
          </NavigationMenu.Root>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item value="two">
        <NavigationMenu.Trigger data-testid="trigger-two" v-bind="triggers?.two">
          Two
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          data-testid="content-two"
          style="width: 300px; height: 150px"
          v-bind="contents?.two"
        >
          <NavigationMenu.Link href="#two-a" data-testid="link-two-a">Two A</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item>
        <NavigationMenu.Link href="#blog" data-testid="link-blog">Blog</NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Viewport v-if="inline" data-testid="viewport" v-bind="viewport" />
    <NavigationMenu.Portal v-else-if="withPortal.shown" v-bind="portal">
      <NavigationMenu.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
      <NavigationMenu.Positioner data-testid="positioner" v-bind="positioner">
        <Transition v-bind="popupTransition ?? { css: false }" appear>
          <NavigationMenu.Popup data-testid="popup" v-bind="popup">
            <NavigationMenu.Arrow v-if="arrow" data-testid="arrow" v-bind="arrow" />
            <NavigationMenu.Viewport v-if="!noViewport" data-testid="viewport" v-bind="viewport" />
          </NavigationMenu.Popup>
        </Transition>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
  <input id="after" aria-label="After" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>

<style>
.sized {
  width: var(--popup-width, auto);
  height: var(--popup-height, auto);
  overflow: hidden;
  transition:
    width 80ms,
    height 80ms;
}

.animated {
  transition: opacity 80ms;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

.fade-leave-active {
  transition: opacity 80ms;
}

.fade-leave-to {
  opacity: 0;
}
</style>
