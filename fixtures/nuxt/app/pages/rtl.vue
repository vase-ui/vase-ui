<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
import { Tabs } from '@vase-ui/vue/tabs';

useHead({ htmlAttrs: { dir: 'rtl' } });

// Inline styles, so that the layout is in the server HTML and does not wait for a file of the app.
const CONTROL_STYLE = 'position: relative; width: 200px; height: 10px';
const THUMB_STYLE = 'width: 40px; height: 10px';
</script>

<template>
  <main>
    <!-- A part cannot read the `dir` of <html> on a server, so the slider has its own. -->
    <Slider.Root data-testid="slider" dir="rtl" :default-value="30">
      <Slider.Control :style="CONTROL_STYLE">
        <Slider.Track style="width: 100%; height: 10px">
          <Slider.Thumb data-testid="thumb" aria-label="Volume" :style="THUMB_STYLE" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
    <Tabs.Root default-value="a">
      <Tabs.List>
        <Tabs.Tab value="a">A</Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
      </Tabs.List>
    </Tabs.Root>
  </main>
</template>
