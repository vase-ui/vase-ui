<script setup lang="ts">
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';
import LabelableAsyncSlot from './LabelableAsyncSlot.test.vue';
</script>

<template>
  <LabelableScope>
    <LabelableControl data-testid="control" />
    <Suspense>
      <LabelableAsyncSlot>
        <LabelableLabel :native="false" data-testid="label">Label</LabelableLabel>
      </LabelableAsyncSlot>
    </Suspense>
  </LabelableScope>
</template>
