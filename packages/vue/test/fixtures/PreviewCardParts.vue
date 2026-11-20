<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { PreviewCard } from '../../src/preview-card';

type Item = { key: string; attrs?: Record<string, unknown> };
type Props = Record<string, unknown>;

// Each link has the text, the `data-key` and the `href` of its key. With no `triggers`, the root has
// one link with the key `t`. A text input stands before the root, and the outside button is at the
// bottom right of the view, so the popup under a link does not cover it. The popup holds text and
// a button, and the parts that their props name.
defineProps({
  root: Object as PropType<Props>,
  triggers: { type: Array as PropType<Item[]>, default: () => [{ key: 't' }] },
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  arrow: Object as PropType<Props>,
  viewport: Object as PropType<Props>,
  /** Two arrows that mount while their value is `true`: 8 px and 20 px wide. */
  arrows: Object as PropType<{ first: boolean; second: boolean }>,
  noPopup: Boolean,
  noPortal: Boolean,
  /** A second preview card in the popup, with its own link. */
  nested: Object as PropType<{ root?: Props; trigger?: Props; portal?: Props }>,
});
const rootPart = useTemplateRef('rootPart');
const popupPart = useTemplateRef('popupPart');
defineExpose({ root: rootPart, popup: popupPart });
</script>

<template>
  <input id="before" aria-label="Before" />
  <PreviewCard.Root ref="rootPart" v-bind="root">
    <template #default="{ payload }">
      <PreviewCard.Trigger
        v-for="trigger in triggers"
        :key="trigger.key"
        :data-key="trigger.key"
        :href="`#${trigger.key}`"
        v-bind="trigger.attrs"
      >
        {{ trigger.key }}
      </PreviewCard.Trigger>
      <PreviewCard.Portal v-if="!noPortal" v-bind="portal">
        <PreviewCard.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
        <PreviewCard.Positioner data-testid="positioner" v-bind="positioner">
          <PreviewCard.Popup v-if="!noPopup" ref="popupPart" data-testid="popup" v-bind="popup">
            <PreviewCard.Arrow v-if="arrow" data-testid="arrow" v-bind="arrow" />
            <PreviewCard.Arrow
              v-if="arrows?.first"
              key="first"
              data-testid="first-arrow"
              style="width: 8px; height: 8px"
            />
            <PreviewCard.Arrow
              v-if="arrows?.second"
              key="second"
              data-testid="second-arrow"
              style="width: 20px; height: 8px"
            />
            <PreviewCard.Viewport v-if="viewport" data-testid="viewport" v-bind="viewport">
              <span data-testid="payload">{{ payload }}</span>
            </PreviewCard.Viewport>
            <span v-else data-testid="payload">{{ payload }}</span>
            <p data-testid="text">Text of the card</p>
            <button data-testid="button">Button</button>
            <PreviewCard.Root v-if="nested" v-bind="nested.root">
              <PreviewCard.Trigger data-key="nested" href="#nested" v-bind="nested.trigger">
                nested
              </PreviewCard.Trigger>
              <PreviewCard.Portal v-bind="nested.portal">
                <PreviewCard.Positioner data-testid="nested-positioner">
                  <PreviewCard.Popup data-testid="nested-popup">
                    <p data-testid="nested-text">Text of the nested card</p>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </template>
  </PreviewCard.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
