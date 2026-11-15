<script setup lang="ts">
import { shallowRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';

const showPreview = shallowRef(false);
</script>

<template>
  <div :class="styles.Wrapper">
    <label :class="styles.Checkbox">
      <input v-model="showPreview" type="checkbox" />
      Show the preview
    </label>
    <Resizable.Root :class="styles.Root">
      <Resizable.Panel id="editor" :class="styles.Panel">
        <p :class="styles.Label">Editor</p>
        <p :class="styles.Description">The code of the page.</p>
      </Resizable.Panel>
      <template v-if="showPreview">
        <Resizable.Handle primary-panel="next" aria-label="Resize the preview" :class="styles.Handle" />
        <Resizable.Panel id="preview" default-size="40" :class="styles.Panel">
          <p :class="styles.Label">Preview</p>
          <p :class="styles.Description">The root gives room to this panel when it mounts.</p>
        </Resizable.Panel>
      </template>
    </Resizable.Root>
  </div>
</template>
