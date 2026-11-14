<script setup lang="ts">
import { h } from 'vue';
import { createPopupFixtureHandle } from '../../../test/fixtures/PopupFixture';
import PopupRootPart from '../../../test/fixtures/PopupRootPart.vue';

const handle = createPopupFixtureHandle<unknown>();
// A component of its own renders after the `setup` of the root, as a part of a consumer does.
const IsOpen = () => h('output', handle.isOpen ? 'open' : 'closed');
</script>

<template>
  <PopupRootPart :handle="handle" default-open />
  <IsOpen />
</template>
