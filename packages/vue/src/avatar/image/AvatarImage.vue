<script lang="ts">
import type { ImgHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { AvatarRootState, ImageLoadingStatus } from '../root/AvatarRoot.vue';

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AvatarImageProps
  extends
    VaseUIComponentProps<AvatarImageState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<ImgHTMLAttributes>,
      'crossorigin' | 'referrerpolicy' | 'sizes' | 'src' | 'srcset'
    > {
  // The part reads these five attributes to load the image before it renders the element.
  // `$attrs` is not reactive, so each of them is a declared prop.
  /**
   * The URL of the image.
   */
  src?: string | undefined;
  /**
   * The candidate sources of the image, as in the `srcset` attribute of `<img>`.
   */
  srcset?: string | undefined;
  /**
   * The display sizes of the image, as in the `sizes` attribute of `<img>`.
   */
  sizes?: string | undefined;
  /**
   * The CORS setting of the image request, as in the `crossorigin` attribute of `<img>`.
   */
  crossorigin?: 'anonymous' | 'use-credentials' | '' | undefined;
  /**
   * The referrer policy of the image request, as in the `referrerpolicy` attribute of `<img>`.
   */
  referrerpolicy?:
    | ''
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined;
  /**
   * Whether the image element stays mounted and loads in place instead of being preloaded.
   * Supports `loading="lazy"` and an image component that renders its own `<img>`.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, onUpdated, watch } from 'vue';
import { areArraysEqual } from '../../common/areArraysEqual';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';
import { useImageLoadingStatus } from './useImageLoadingStatus';

defineOptions({ inheritAttrs: false });

const stateAttributesMapping: StateAttributesMapping<AvatarImageState> = {
  ...avatarStateAttributesMapping,
  ...transitionStatusMapping,
};

const props = withDefaults(defineProps<AvatarImageProps>(), { as: 'img', keepMounted: false });

const emit = defineEmits<{
  /**
   * Callback fired when the loading status changes.
   */
  loadingStatusChange: [status: ImageLoadingStatus];
}>();

defineSlots<{
  render: ComponentRenderFn<ImgHTMLAttributes & Pick<HTMLProps, 'ref'>, AvatarImageState>;
}>();

const { setImageLoadingStatus: setRootImageLoadingStatus } = useAvatarRootContext();
const [imageLoadingStatus, setImageLoadingStatus] = useImageLoadingStatus(
  () => props.src,
  () => ({
    crossOrigin: props.crossorigin,
    referrerPolicy: props.referrerpolicy,
    sizes: props.sizes,
    srcSet: props.srcset,
  }),
  () => !props.keepMounted,
);

const isVisible = computed(() => imageLoadingStatus.value === 'loaded');
// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
// The image has an enter transition, so the composable needs the element.
const { mounted, setMounted, transitionStatus } = useTransitionStatus(
  isVisible,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<AvatarImageState>(() => ({
  imageLoadingStatus: imageLoadingStatus.value,
  // With `keepMounted`, the element stays in the DOM. An exit transition would play and then
  // reverse when the status clears. `data-loading` and `data-error` show that state.
  transitionStatus:
    props.keepMounted && transitionStatus.value === 'ending' ? undefined : transitionStatus.value,
}));

function definedProps(values: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function getRenderedStatusProps() {
  if (!props.keepMounted) {
    return undefined;
  }

  return {
    // A `keepMounted` element exists before the image loads, so the not-loaded states need data
    // attributes. The default mode must not set them while the element animates out.
    'data-loading': imageLoadingStatus.value === 'loading' ? '' : undefined,
    'data-error': imageLoadingStatus.value === 'error' ? '' : undefined,
    // Until the image can show, the fallback gives the accessible name. Without `aria-hidden`,
    // assistive technology would get both names, also from the server HTML.
    'aria-hidden': imageLoadingStatus.value !== 'loaded' || undefined,
    onLoad() {
      setImageLoadingStatus('loaded');
    },
    onError() {
      setImageLoadingStatus('error');
    },
  };
}

const { element, elementProps } = useRenderElement<AvatarImageState, HTMLImageElement>(
  'img',
  props,
  {
    state,
    props: (attrs) => [
      getRenderedStatusProps(),
      definedProps({ crossorigin: props.crossorigin, referrerpolicy: props.referrerpolicy }),
      attrs,
      // Safari and Firefox start the fetch when `src` is set. They ignore a `loading`, `sizes` or
      // `srcset` that comes later. Vue sets the attributes in key order, so the source props
      // come last, with `src` as the last key.
      definedProps({ sizes: props.sizes, srcset: props.srcset, src: props.src }),
    ],
    stateAttributesMapping,
  },
);

useOpenChangeComplete({
  enabled: () => !isVisible.value,
  open: isVisible,
  ref: element,
  onComplete() {
    if (!isVisible.value) {
      setMounted(false);
    }
  },
});

watch(imageLoadingStatus, (status) => {
  if (status !== 'idle') {
    emit('loadingStatusChange', status);
    setRootImageLoadingStatus(status);
  }
});

onUnmounted(() => setRootImageLoadingStatus('idle'));

let isFirstRead = true;
let lastRead: unknown[] | undefined;

// With `keepMounted`, the status comes from the rendered element. Its `load` event can fire
// before the hydration, and its image can be cached.
// The hooks run after each DOM update of the part. A `#render` element has a source of its own,
// so no prop shows that the source changed.
function readRenderedImage() {
  if (!props.keepMounted) {
    lastRead = undefined;
    return;
  }

  const isInitialRead = isFirstRead;
  isFirstRead = false;

  const image = element.value;
  if (!image) {
    // The `#render` element did not give the ref to the part. Its own `load` and `error` events
    // are then the only source of the status. Do not overwrite a status that they set.
    return;
  }

  // A render that changes no source must not read again. The read could replace a status that a
  // `load` event set with the state of an image that the browser did not load yet.
  const read = [
    image,
    image.getAttribute('src'),
    image.getAttribute('srcset'),
    image.getAttribute('sizes'),
    image.getAttribute('crossorigin'),
    image.getAttribute('referrerpolicy'),
  ];
  if (lastRead && areArraysEqual(lastRead, read)) {
    return;
  }
  lastRead = read;

  if (!image.complete) {
    setImageLoadingStatus('loading');
    return;
  }

  const status = image.naturalWidth > 0 ? 'loaded' : 'error';
  // The browser already painted an image that is complete at the first read. It must not animate
  // in again. The sync watcher of `useTransitionStatus` runs in each write. A status write first
  // would set `'starting'`. Mounting first sets a stale `'ending'` instead. The state hides that
  // value with `keepMounted`, and the composable clears it in the next frame.
  if (status === 'loaded' && isInitialRead) {
    setMounted(true);
  }
  setImageLoadingStatus(status);
}

onMounted(readRenderedImage);
onUpdated(readRenderedImage);

defineExpose({ element });
</script>

<template>
  <template v-if="keepMounted || mounted">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()" />
  </template>
</template>
