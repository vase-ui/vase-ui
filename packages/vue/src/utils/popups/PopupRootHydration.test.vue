<script setup lang="ts">
import { createPopupFixtureHandle } from '../../../test/fixtures/PopupFixture';
import type { PopupFixtureHandle } from '../../../test/fixtures/PopupFixture';
import PopupPart from '../../../test/fixtures/PopupPart.vue';
import PopupRootPart from '../../../test/fixtures/PopupRootPart.vue';
import PopupTriggerPart from '../../../test/fixtures/PopupTriggerPart.vue';
import FloatingPortalLite from './portal/FloatingPortalLite.vue';

const props = withDefaults(
  defineProps<{
    handle?: PopupFixtureHandle<unknown> | undefined;
    open?: boolean | undefined;
    defaultOpen?: boolean | undefined;
    triggerId?: string | null | undefined;
    defaultTriggerId?: string | null | undefined;
    // The ids of the triggers in the root. `null` gives a trigger a generated id.
    triggers?: (string | null)[] | undefined;
    detachedBefore?: string | undefined;
    detachedAfter?: string | undefined;
    popupId?: string | undefined;
    keepMounted?: boolean | undefined;
  }>(),
  {
    handle: undefined,
    open: undefined,
    defaultOpen: false,
    triggerId: undefined,
    defaultTriggerId: null,
    triggers: () => ['first'],
    detachedBefore: undefined,
    detachedAfter: undefined,
    popupId: undefined,
    keepMounted: false,
  },
);

// A render with no `handle` prop makes its own handle, as an app does in `setup`.
const handle = props.handle ?? createPopupFixtureHandle<unknown>();
</script>

<template>
  <PopupTriggerPart v-if="detachedBefore" :id="detachedBefore" :handle="handle">
    detached before
  </PopupTriggerPart>
  <PopupRootPart
    :handle="handle"
    :open="open"
    :default-open="defaultOpen"
    :trigger-id="triggerId"
    :default-trigger-id="defaultTriggerId"
  >
    <PopupTriggerPart v-for="(id, index) in triggers" :key="index" :id="id ?? undefined">
      trigger {{ index }}
    </PopupTriggerPart>
    <FloatingPortalLite>
      <PopupPart :keep-mounted="keepMounted" v-bind="popupId ? { id: popupId } : {}">
        popup
      </PopupPart>
    </FloatingPortalLite>
  </PopupRootPart>
  <PopupTriggerPart v-if="detachedAfter" :id="detachedAfter" :handle="handle">
    detached after
  </PopupTriggerPart>
</template>
