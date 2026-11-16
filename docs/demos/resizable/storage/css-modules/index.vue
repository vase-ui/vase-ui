<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';

const { layout, save } = Resizable.useLayoutStorage({ key: 'vase-ui-docs-resizable' });
</script>

<template>
  <Resizable.Root v-model:layout="layout" :class="styles.Root" @layout-committed="save">
    <Resizable.Panel id="navigation" default-size="30" :class="styles.Panel">
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">Resize the panels, then load the page again.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the navigation" :class="styles.Handle" />
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">The layout stays in the storage of the browser.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
