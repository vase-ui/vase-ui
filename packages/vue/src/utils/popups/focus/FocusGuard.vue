<script lang="ts">
import type { HTMLAttributes } from 'vue';

export interface FocusGuardProps extends /* @vue-ignore */ HTMLAttributes {}
</script>

<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { platform } from '../../../common/platform';
import { visuallyHidden } from '../../../common/visuallyHidden';

defineProps<FocusGuardProps>();

const element = shallowRef<HTMLSpanElement | null>(null);
const role = shallowRef<'button'>();

// A server calls no mount hook and cannot know the engine, so the server HTML has the hidden form.
// Unlike the cursor of NVDA and JAWS, the cursor of VoiceOver moves the focus. In WebKit it moves
// the focus only to a focusable element that has `role="button"`. With that role, the focus trap
// catches the cursor. The label gives that button a name. Without a name, axe reports the guard:
// https://github.com/mui/base-ui/issues/5237
onMounted(() => {
  if (platform.screenReader.voiceOver && platform.engine.webkit) {
    role.value = 'button';
  }
});

defineExpose({ element });
</script>

<template>
  <span
    ref="element"
    tabindex="0"
    :role="role"
    :aria-hidden="role ? undefined : true"
    :aria-label="role ? 'Focus guard' : undefined"
    :style="visuallyHidden"
    data-vase-ui-focus-guard=""
  />
</template>
