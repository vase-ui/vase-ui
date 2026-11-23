<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import '../../../behavior/style.css';
import '../../../behavior/resizablePanels.css';
</script>

<template>
  <div class="bench-panels">
    <Resizable.Root data-bench="group">
      <Resizable.Panel
        id="panel-1"
        data-bench="panel-1"
        default-size="50"
        min-size="20"
        max-size="80"
        collapsible
      >
        <p>Panel 1</p>
      </Resizable.Panel>
      <Resizable.Handle data-bench="handle" aria-label="Resize panel 1" />
      <Resizable.Panel id="panel-2" data-bench="panel-2">
        <iframe data-bench="frame" title="Panel 2" srcdoc="<p>Panel 2</p>"></iframe>
      </Resizable.Panel>
    </Resizable.Root>
  </div>
</template>
