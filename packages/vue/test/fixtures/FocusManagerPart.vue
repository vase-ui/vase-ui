<script setup lang="ts">
import { onMounted, onScopeDispose, useTemplateRef, watch } from 'vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import FocusGuard from '../../src/utils/popups/focus/FocusGuard.vue';
import { usePortalContext } from '../../src/utils/popups/portal/FloatingPortalContext';

// A mock of `FloatingFocusManager` for the tests of the portal. As the focus manager does, it gives
// its state to the portal around it and it renders the inside guards around its content.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    open?: boolean | undefined;
    modal?: boolean | undefined;
    closeOnFocusOut?: boolean | undefined;
    domReference?: Element | null | undefined;
  }>(),
  { open: true, modal: false, closeOnFocusOut: true, domReference: null },
);

const emit = defineEmits<{
  openChange: [open: boolean, eventDetails: VaseUIChangeEventDetails<string>];
}>();

const portalContext = usePortalContext();
const beforeGuard = useTemplateRef('beforeGuard');
const afterGuard = useTemplateRef('afterGuard');

function publishState() {
  portalContext?.setFocusManagerState({
    modal: props.modal,
    open: props.open,
    closeOnFocusOut: props.closeOnFocusOut,
    domReference: props.domReference,
    onOpenChange: (open, eventDetails) => emit('openChange', open, eventDetails),
  });
}

onMounted(publishState);
watch(() => [props.open, props.modal, props.closeOnFocusOut, props.domReference], publishState);
onScopeDispose(() => portalContext?.setFocusManagerState(null));

watch(
  [beforeGuard, afterGuard],
  ([before, after]) => {
    if (portalContext) {
      portalContext.beforeInsideRef.value = before?.element ?? null;
      portalContext.afterInsideRef.value = after?.element ?? null;
    }
  },
  { flush: 'post' },
);
</script>

<template>
  <FocusGuard ref="beforeGuard" data-type="inside" />
  <slot />
  <FocusGuard ref="afterGuard" data-type="inside" />
</template>
