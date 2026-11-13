<script setup lang="ts">
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableMessage from '../../../test/fixtures/LabelableMessage.vue';

defineProps<{
  messageBeforeControl: boolean;
}>();
</script>

<template>
  <LabelableMessage v-if="messageBeforeControl" id="error" data-testid="message">
    Message
  </LabelableMessage>
  <LabelableControl data-testid="control" />
  <LabelableMessage v-if="!messageBeforeControl" id="error" data-testid="message">
    Message
  </LabelableMessage>
</template>
