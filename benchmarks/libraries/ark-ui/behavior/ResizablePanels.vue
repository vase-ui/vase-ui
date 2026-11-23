<script setup lang="ts">
import { Splitter } from '@ark-ui/vue/splitter';
import '../../../behavior/style.css';
import '../../../behavior/resizablePanels.css';
</script>

<template>
  <div class="bench-panels">
    <Splitter.Root
      data-bench="group"
      :default-size="[50, 50]"
      :panels="[
        { id: 'panel-1', minSize: 20, maxSize: 80, collapsible: true, collapsedSize: 0 },
        { id: 'panel-2' },
      ]"
    >
      <Splitter.Panel id="panel-1" data-bench="panel-1">
        <p>Panel 1</p>
      </Splitter.Panel>
      <Splitter.ResizeTrigger id="panel-1:panel-2" data-bench="handle" aria-label="Resize panel 1">
        <Splitter.ResizeTriggerIndicator />
      </Splitter.ResizeTrigger>
      <Splitter.Panel id="panel-2" data-bench="panel-2">
        <iframe data-bench="frame" title="Panel 2" srcdoc="<p>Panel 2</p>"></iframe>
      </Splitter.Panel>
    </Splitter.Root>
  </div>
</template>
