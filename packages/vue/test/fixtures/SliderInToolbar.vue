<script setup lang="ts">
import { Slider } from '../../src/slider';
import { Toolbar } from '../../src/toolbar';
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Button id="first">First</Toolbar.Button>
    <Slider.Root :default-value="50" aria-label="Volume">
      <Toolbar.Button id="inside">Inside</Toolbar.Button>
      <Slider.Control>
        <Slider.Track>
          <Slider.Thumb />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
    <Toolbar.Button id="last">Last</Toolbar.Button>
  </Toolbar.Root>
</template>
