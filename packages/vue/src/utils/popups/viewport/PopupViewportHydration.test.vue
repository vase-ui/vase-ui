<script setup lang="ts">
import PopupPart from '../../../../test/fixtures/PopupPart.vue';
import PopupPositionerPart from '../../../../test/fixtures/PopupPositionerPart.vue';
import PopupRootPart from '../../../../test/fixtures/PopupRootPart.vue';
import PopupTriggerPart from '../../../../test/fixtures/PopupTriggerPart.vue';
import PopupViewportPart from '../../../../test/fixtures/PopupViewportPart.vue';
</script>

<template>
  <PopupRootPart default-open default-trigger-id="trigger">
    <PopupTriggerPart
      id="trigger"
      payload="payload"
      style="position: fixed; left: 200px; top: 100px; width: 40px; height: 20px"
    >
      trigger
    </PopupTriggerPart>
    <PopupPositionerPart position-method="fixed" data-testid="positioner">
      <PopupPart>
        <PopupViewportPart data-testid="viewport">
          <span data-testid="content">content</span>
        </PopupViewportPart>
      </PopupPart>
    </PopupPositionerPart>
  </PopupRootPart>
</template>
