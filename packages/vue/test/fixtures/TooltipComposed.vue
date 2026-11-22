<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';
import { Toolbar } from '../../src/toolbar';
import { Tooltip } from '../../src/tooltip';

type Props = Record<string, unknown>;

// A tooltip trigger with another element or part. Each trigger has the id `trigger`, and each popup
// of a tooltip has the test id `popup`. With the kind `renders`, each trigger calls `renders.count`
// with its id and its open state at each render of its content, and shows the text that it gives.
// With the kind `nested`, `second` adds a second inner trigger with the id `second`, and `third`
// adds a trigger with the id `third` in the inner trigger. Their popups have the test ids
// `second-popup` and `third-popup`.
defineProps({
  kind: {
    type: String as PropType<
      | 'disabled-button'
      | 'toolbar-button'
      | 'fieldset'
      | 'popover-trigger'
      | 'in-popover'
      | 'outside-popover'
      | 'nested'
      | 'renders'
    >,
    required: true,
  },
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  inner: Object as PropType<Props>,
  second: Object as PropType<Props>,
  third: Object as PropType<Props>,
  popover: Object as PropType<Props>,
  renders: {
    type: Object as PropType<{ count(id: string, open: boolean): string }>,
    default: () => ({ count: () => '' }),
  },
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
  <Toolbar.Root v-else-if="kind === 'toolbar-button'">
    <Tooltip.Root v-bind="root">
      <Tooltip.Trigger v-bind="trigger">
        <template #element="{ props, elementRef }">
          <Toolbar.Button v-bind="props" id="trigger" disabled :ref="elementRef"
            >Push</Toolbar.Button
          >
        </template>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="popup">Nothing to push</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Toolbar.Root>
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
  <Tooltip.Provider v-else-if="kind === 'renders'">
    <Tooltip.Root>
      <Tooltip.Trigger id="trigger" :delay="0" v-slot="{ state }">
        A{{ renders.count('trigger', state.open) }}
      </Tooltip.Trigger>
      <Tooltip.Trigger id="second" v-slot="{ state }">
        B{{ renders.count('second', state.open) }}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid="popup">Bold</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
    <Tooltip.Root>
      <Tooltip.Trigger id="other" v-slot="{ state }">
        C{{ renders.count('other', state.open) }}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>Italic</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
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
          <Tooltip.Root v-if="third">
            <Tooltip.Trigger
              id="third"
              as="span"
              style="display: inline-block; width: 30px; height: 60px"
              v-bind="third"
            >
              Third
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="third-popup">Third tip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="inner-popup">Inner tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Tooltip.Root v-if="second">
        <Tooltip.Trigger
          id="second"
          as="span"
          style="display: inline-block; width: 80px; height: 60px"
          v-bind="second"
        >
          Second
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="second-popup">Second tip</Tooltip.Popup>
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
