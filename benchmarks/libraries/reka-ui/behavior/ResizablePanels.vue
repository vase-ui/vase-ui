<script setup lang="ts">
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui';
import '../../../behavior/style.css';
import '../../../behavior/resizablePanels.css';
</script>

<template>
  <div class="bench-panels">
    <SplitterGroup direction="horizontal" data-bench="group">
      <SplitterPanel
        id="panel-1"
        data-bench="panel-1"
        :default-size="50"
        :min-size="20"
        :max-size="80"
        collapsible
        :collapsed-size="0"
      >
        <p>Panel 1</p>
      </SplitterPanel>
      <SplitterResizeHandle data-bench="handle" />
      <SplitterPanel id="panel-2" data-bench="panel-2">
        <iframe data-bench="frame" title="Panel 2" srcdoc="<p>Panel 2</p>"></iframe>
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
