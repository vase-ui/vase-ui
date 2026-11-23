<script setup lang="ts">
import { Splitter } from '@vuetify/v0';
import '../../../behavior/style.css';
import '../../../behavior/resizablePanels.css';
</script>

<template>
  <div class="bench-panels">
    <Splitter.Root data-bench="group">
      <Splitter.Panel
        data-bench="panel-1"
        :default-size="50"
        :min-size="20"
        :max-size="80"
        collapsible
        :collapsed-size="0"
      >
        <p>Panel 1</p>
      </Splitter.Panel>
      <Splitter.Handle data-bench="handle" label="Resize panel 1" />
      <Splitter.Panel data-bench="panel-2" :default-size="50">
        <iframe data-bench="frame" title="Panel 2" srcdoc="<p>Panel 2</p>"></iframe>
      </Splitter.Panel>
    </Splitter.Root>
  </div>
</template>
