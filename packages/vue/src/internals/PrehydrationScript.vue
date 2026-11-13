<script setup lang="ts">
import { useIsHydrating } from '../common/hydration';
import { useCSPContext } from './csp-context/CSPContext';

const props = defineProps<{ script: string }>();

// Only a server gives the element its text. A script element that Vue makes with a text runs when
// Vue inserts it. The `browser` condition of `imports` also gives a client bundle an empty text, but
// a bundler of a consumer can ignore that condition.
// The text goes in `innerHTML`. On a server, text interpolation changes `&`, `<`, `>`, `"` and `'`
// into entities, and a browser does not decode an entity in a `<script>`.
// A client render has no `innerHTML`, not even an empty one. Vue assigns an `innerHTML` prop through
// its own Trusted Types policy, named `vue`. A page that requires Trusted Types for scripts and has
// no `vue` entry in its `trusted-types` list makes that assignment throw.
// eslint-disable-next-line no-restricted-globals -- The SFC has no element, so `ownerDocument` does not apply. The typeof check tells a server from a client.
const textProps = typeof document === 'undefined' ? { innerHTML: props.script } : {};

const csp = useCSPContext();
// While the part hydrates, the client renders the element too, so that Vue finds the element of the
// server HTML. The element goes away in the flush after the mount.
const isHydrating = useIsHydrating();
</script>

<template>
  <component :is="'script'" v-if="isHydrating" :nonce.attr="csp.nonce" v-bind="textProps" />
</template>
