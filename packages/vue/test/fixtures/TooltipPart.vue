<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Tooltip } from '../../src/tooltip';

type Item = { key: string; attrs?: Record<string, unknown> };
type Props = Record<string, unknown>;

// One tooltip. Each trigger has the text and the `data-key` of its key. The popup has the test ids
// `popup-<name>` and `positioner-<name>`, a payload and a button. With `transition`, the popup is
// in a `<Transition appear>` of that name.
const props = defineProps({
  name: { type: String, default: 't' },
  root: Object as PropType<Props>,
  triggers: Array as PropType<Item[]>,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  arrow: Object as PropType<Props>,
  viewport: Boolean,
  transition: String,
  noPopup: Boolean,
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });
const triggerList = () => props.triggers ?? [{ key: props.name }];
</script>

<template>
  <Tooltip.Root ref="rootPart" v-bind="root">
    <template #default="{ payload }">
      <Tooltip.Trigger
        v-for="trigger in triggerList()"
        :key="trigger.key"
        :data-key="trigger.key"
        v-bind="trigger.attrs"
      >
        {{ trigger.key }}
      </Tooltip.Trigger>
      <Tooltip.Portal v-bind="portal">
        <Tooltip.Positioner :data-testid="`positioner-${name}`" v-bind="positioner">
          <template v-if="!noPopup">
            <Transition v-if="transition" :name="transition" appear>
              <Tooltip.Popup :data-testid="`popup-${name}`" v-bind="popup">
                <Tooltip.Arrow v-if="arrow" :data-testid="`arrow-${name}`" v-bind="arrow" />
                Tip {{ name }} <span data-testid="payload">{{ payload }}</span>
              </Tooltip.Popup>
            </Transition>
            <Tooltip.Popup v-else :data-testid="`popup-${name}`" v-bind="popup">
              <Tooltip.Arrow v-if="arrow" :data-testid="`arrow-${name}`" v-bind="arrow" />
              <Tooltip.Viewport v-if="viewport" :data-testid="`viewport-${name}`">
                <template #default="{ triggerId }">{{ triggerId }}</template>
              </Tooltip.Viewport>
              <template v-else>
                Tip {{ name }} <span data-testid="payload">{{ payload }}</span>
              </template>
            </Tooltip.Popup>
          </template>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </template>
  </Tooltip.Root>
</template>
