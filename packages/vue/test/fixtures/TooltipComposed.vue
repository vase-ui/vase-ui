<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';
import { Toolbar } from '../../src/toolbar';
import { Tooltip } from '../../src/tooltip';

type Props = Record<string, unknown>;

// A tooltip trigger with another element or part. Each trigger has the id `trigger`, and each popup
// of a tooltip has the test id `popup`.
defineProps({
  kind: {
    type: String as PropType<
      | 'disabled-button'
      | 'fieldset'
      | 'popover-trigger'
      | 'toolbar-button'
      | 'in-popover'
      | 'outside-popover'
      | 'nested'
    >,
    required: true,
  },
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  inner: Object as PropType<Props>,
  popover: Object as PropType<Props>,
});
</script>

<template>
  <fieldset v-if="kind === 'fieldset'" disabled>
    <Tooltip.Root v-bind="root">
      <Tooltip.Trigger id="trigger" v-bind="trigger">Save</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="popup">Nothing changed</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </fieldset>
  <Tooltip.Root v-else-if="kind === 'disabled-button'" v-bind="root">
    <Tooltip.Trigger v-bind="trigger">
      <template #element="{ props, elementRef }">
        <button v-bind="props" id="trigger" disabled :ref="elementRef">Save</button>
      </template>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup data-testid="popup">Nothing changed</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
  <Popover.Root v-else-if="kind === 'popover-trigger'" v-bind="popover">
    <Tooltip.Root v-bind="root">
      <Tooltip.Trigger id="trigger" v-bind="trigger">
        <template #element="{ props, elementRef }">
          <Popover.Trigger v-bind="props" :ref="elementRef">Share</Popover.Trigger>
        </template>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="popup">Copies the link</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover">Links</Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Toolbar.Root v-else-if="kind === 'toolbar-button'">
    <Toolbar.Button id="first">First</Toolbar.Button>
    <Tooltip.Root v-bind="root">
      <Tooltip.Trigger id="trigger" v-bind="trigger">
        <template #element="{ props, elementRef }">
          <Toolbar.Button v-bind="{ ...props, ...inner }" :ref="elementRef">Push</Toolbar.Button>
        </template>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="popup">Nothing waits</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Toolbar.Root>
  <template v-else-if="kind === 'in-popover' || kind === 'outside-popover'">
    <Popover.Root v-bind="popover">
      <Popover.Trigger id="popover-trigger">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="popover">
            <Tooltip.Root v-if="kind === 'in-popover'" v-bind="root">
              <Tooltip.Trigger id="trigger" v-bind="trigger">Bold</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">Makes the text heavy</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <Tooltip.Root v-if="kind === 'outside-popover'" v-bind="root">
      <Tooltip.Trigger id="trigger" style="position: fixed; left: 0; bottom: 0" v-bind="trigger">
        Bold
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="popup">Makes the text heavy</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </template>
  <Tooltip.Root v-else v-bind="root">
    <Tooltip.Trigger
      id="trigger"
      style="display: inline-block; width: 300px; height: 60px"
      v-bind="trigger"
    >
      <Tooltip.Root>
        <Tooltip.Trigger
          id="inner"
          as="span"
          style="display: inline-block; width: 80px; height: 60px"
          v-bind="inner"
        >
          Inner
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="inner-popup">Inner tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup data-testid="popup">Outer tip</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
