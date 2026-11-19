<script setup lang="ts">
import { computed, mergeProps, onMounted, onUnmounted, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { injectAvatarRoot } from './root';
import type { AvatarImageProps, AvatarImageState, ImageLoadingStatus } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<AvatarImageProps>();
const emit = defineEmits<{
  /**
   * Callback fired when the loading status changes.
   */
  loadingStatusChange: [status: ImageLoadingStatus];
}>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AvatarImageState;
  }): unknown;
}>();

// WebKit starts the request when `src` is set, before a later `loading`, `srcset` or request option
// has an effect (measurement M3). So the sources come last.
const REQUEST_OPTIONS = ['crossorigin', 'referrerpolicy'] as const;
const SOURCES = ['sizes', 'srcset', 'src'] as const;

const root = injectAvatarRoot('Image');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLImageElement>();
const shows = computed(() => props.keepMounted || root.state.imageLoadingStatus === 'loaded');

// Vue keeps the listeners of a removed element, and the browser loads its picture after the part
// unmounts.
let unmounted = false;

function setStatus(status: ImageLoadingStatus) {
  if (unmounted || status === root.state.imageLoadingStatus) return;
  root.setStatus(status);
  emit('loadingStatusChange', status);
}

function readStatus(image: HTMLImageElement): ImageLoadingStatus {
  if (!image.complete) return 'loading';
  return image.naturalWidth > 0 ? 'loaded' : 'error';
}

function readWhenSelected(image: HTMLImageElement) {
  const read = () => setStatus(readStatus(image));
  // Firefox selects the source of `srcset` one microtask after the change (measurement M1).
  if (image.hasAttribute('srcset')) queueMicrotask(read);
  else read();
}

/** The request attributes that the developer gave, in the order of `names`. */
function given(names: readonly (typeof REQUEST_OPTIONS | typeof SOURCES)[number][]) {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = props[name];
    if (value !== undefined) values[name] = value;
  }
  return values;
}

// Without `keepMounted`, an image outside the document loads the picture, and the element renders
// only a loaded picture. The default flush gives the status to the render of the same update.
onMounted(() => {
  watch(
    () => (props.keepMounted ? undefined : given([...REQUEST_OPTIONS, ...SOURCES])),
    (attributes, _, onCleanup) => {
      if (!attributes) return;
      const image = new Image();
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      const { signal } = controller;
      image.addEventListener('load', () => setStatus('loaded'), { signal });
      image.addEventListener('error', () => setStatus('error'), { signal });
      for (const [name, value] of Object.entries(attributes)) image.setAttribute(name, value);
      readWhenSelected(image);
    },
    { immediate: true },
  );
});

// With `keepMounted`, the element loads the picture. The browser sends no event when a source
// changes, and the picture can load before the hydration, so the part reads each new element and
// each change of its request attributes.
watch(
  () => (props.keepMounted ? element.value : null),
  (image, _, onCleanup) => {
    if (!image) return;
    const observer = new MutationObserver(() => readWhenSelected(image));
    observer.observe(image, { attributeFilter: [...REQUEST_OPTIONS, ...SOURCES] });
    onCleanup(() => observer.disconnect());
    readWhenSelected(image);
  },
  { flush: 'post' },
);

onUnmounted(() => {
  unmounted = true;
  root.setStatus('idle');
});

// The listener reads the element of the part: Firefox sends the `load` event of a source after a
// new source replaced it (measurement M4), and an element that the slot replaced can load after
// the new one. A component that gives the part no element gives the target of the event.
function onLoadOrError(event: Event) {
  setStatus(readStatus(element.value ?? (event.currentTarget as HTMLImageElement)));
}

defineExpose({ element });

function elementProps() {
  const status = root.state.imageLoadingStatus;
  return mergeProps(
    given(REQUEST_OPTIONS),
    props.keepMounted
      ? {
          'data-loading': status === 'loading' ? '' : undefined,
          'data-error': status === 'error' ? '' : undefined,
          // The fallback names the avatar until the picture loads.
          'aria-hidden': status === 'loaded' ? undefined : 'true',
          onLoad: onLoadOrError,
          onError: onLoadOrError,
        }
      : {},
    attrs,
    given(SOURCES),
  );
}

// With no `alt`, some screen readers read the name of the file.
function imageProps() {
  const merged = elementProps();
  merged.alt ??= '';
  return merged;
}
</script>

<template>
  <slot
    v-if="shows && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <img v-else-if="shows" v-bind="imageProps()" :ref="setElement" />
</template>
