<script setup lang="ts">
import { ref } from 'vue';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { Slider } from '@vase-ui/vue/slider';

// Inline styles, so that the layout is in the server HTML and does not wait for a file of the app.
const CONTROL_STYLE = 'position: relative; width: 200px; height: 10px';
const TRACK_STYLE = 'width: 100%; height: 10px';
const THUMB_STYLE = 'width: 40px; height: 10px';

const volume = ref(30);
</script>

<template>
  <main>
    <CSPProvider nonce="test-nonce">
      <form data-testid="form">
        <Slider.Root v-model:value="volume" data-testid="volume" name="volume">
          <Slider.Label data-testid="volume-label">Volume</Slider.Label>
          <Slider.Control data-testid="volume-control" :style="CONTROL_STYLE">
            <Slider.Track :style="TRACK_STYLE">
              <Slider.Indicator data-testid="volume-indicator" />
              <Slider.Thumb data-testid="volume-thumb" :style="THUMB_STYLE" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <Slider.Root
          data-testid="price"
          name="price"
          :default-value="[25, 75]"
          thumb-alignment="edge"
        >
          <Slider.Control data-testid="price-control" :style="CONTROL_STYLE">
            <Slider.Track :style="TRACK_STYLE">
              <Slider.Indicator data-testid="price-indicator" />
              <Slider.Thumb
                data-testid="price-thumb"
                aria-label="Minimum price"
                :style="THUMB_STYLE"
              />
              <Slider.Thumb
                data-testid="price-thumb"
                aria-label="Maximum price"
                :style="THUMB_STYLE"
              />
            </Slider.Track>
          </Slider.Control>
          <Slider.Label data-testid="price-label">Price</Slider.Label>
        </Slider.Root>
      </form>
      <output data-testid="volume-model">{{ volume }}</output>
    </CSPProvider>
  </main>
</template>
