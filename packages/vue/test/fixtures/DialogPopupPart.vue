<script setup lang="ts">
import { computed } from 'vue';
import { useDialogRootContext } from '../../src/dialog/root/DialogRootContext';

// The tests of Drawer use this part in place of `Drawer.Popup`, which Vase UI does not have. It
// renders the popup element with the props that the root gives.
defineOptions({ inheritAttrs: false });

withDefaults(defineProps<{ keepMounted?: boolean }>(), { keepMounted: false });

const store = useDialogRootContext();

const mounted = computed(() => store.select('mounted'));
const popupProps = computed(() => store.select('popupProps'));
const titleElementId = computed(() => store.select('titleElementId'));
const descriptionElementId = computed(() => store.select('descriptionElementId'));

function setPopupElement(element: unknown) {
  store.context.popupRef.value = element as HTMLElement | null;
  store.set('popupElement', element as HTMLElement | null);
}
</script>

<template>
  <div
    v-if="mounted || keepMounted"
    v-bind="{ ...popupProps, ...$attrs }"
    :ref="setPopupElement"
    role="dialog"
    :hidden="mounted ? undefined : true"
    :aria-labelledby="titleElementId"
    :aria-describedby="descriptionElementId"
  >
    <slot />
  </div>
</template>
