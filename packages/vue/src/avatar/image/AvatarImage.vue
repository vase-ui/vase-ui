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
  // The preload must track these attributes before the element exists.
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
import { computed, onMounted, onUnmounted, onUpdated, shallowRef, watch, watchEffect } from 'vue';
import { areArraysEqual } from '../../common/areArraysEqual';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { avatarStateAttributesMapping, useAvatarRootContext } from '../root/AvatarRootContext';

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
const imageLoadingStatus = shallowRef<ImageLoadingStatus>('idle');
const isVisible = computed(() => imageLoadingStatus.value === 'loaded');

function readStatus(image: HTMLImageElement): ImageLoadingStatus {
  if (!image.complete) {
    return 'loading';
  }
  return image.naturalWidth > 0 ? 'loaded' : 'error';
}

onMounted(() => {
  watchEffect((onCleanup) => {
    if (props.keepMounted) {
      return;
    }
    const { src, srcset, sizes, crossorigin, referrerpolicy } = props;
    if (!src && !srcset) {
      imageLoadingStatus.value = 'error';
      return;
    }

    const image = new Image();
    image.onload = () => {
      imageLoadingStatus.value = 'loaded';
    };
    image.onerror = () => {
      imageLoadingStatus.value = 'error';
    };
    onCleanup(() => {
      image.onload = null;
      image.onerror = null;
    });

    // The browser needs the request options before the first source.
    if (referrerpolicy) {
      image.referrerPolicy = referrerpolicy;
    }
    image.crossOrigin = crossorigin ?? null;
    if (sizes) {
      image.sizes = sizes;
    }
    if (srcset) {
      image.srcset = srcset;
    }
    if (src) {
      image.src = src;
    }

    // A cached replacement must not start an exit transition.
    imageLoadingStatus.value = readStatus(image);
  });
});

const { mounted, setMounted, transitionStatus } = useTransitionStatus(
  isVisible,
  false,
  false,
  false,
  () => element.value,
);

const state = computed<AvatarImageState>(() => ({
  imageLoadingStatus: imageLoadingStatus.value,
  // A kept image stays in place through an error or a new request.
  transitionStatus:
    props.keepMounted && transitionStatus.value === 'ending' ? undefined : transitionStatus.value,
}));

function definedProps(values: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  AvatarImageState,
  HTMLImageElement
>('img', props, {
  state,
  props: (attrs) => [
    props.keepMounted
      ? {
          'data-loading': imageLoadingStatus.value === 'loading' ? '' : undefined,
          'data-error': imageLoadingStatus.value === 'error' ? '' : undefined,
          // The fallback supplies the accessible name until the image loads.
          'aria-hidden': !isVisible.value || undefined,
          onLoad() {
            imageLoadingStatus.value = 'loaded';
          },
          onError() {
            imageLoadingStatus.value = 'error';
          },
        }
      : undefined,
    definedProps({ crossorigin: props.crossorigin, referrerpolicy: props.referrerpolicy }),
    attrs,
    // Safari and Firefox start the request at `src`. Vue applies these keys in order.
    definedProps({ sizes: props.sizes, srcset: props.srcset, src: props.src }),
  ],
  stateAttributesMapping,
});

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
  emit('loadingStatusChange', status);
  setRootImageLoadingStatus(status);
});

onUnmounted(() => setRootImageLoadingStatus('idle'));

let isFirstRead = true;
let lastRead: unknown[] | undefined;

// A render slot can change its own source or finish a request before hydration.
function readRenderedImage() {
  if (!props.keepMounted) {
    lastRead = undefined;
    return;
  }

  const isInitialRead = isFirstRead;
  isFirstRead = false;

  const image = element.value;
  if (!image) {
    // A slot without a ref reports its status through load and error events.
    return;
  }

  // An unrelated patch must preserve the last load or error event.
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

  const status = readStatus(image);
  // The browser already painted a complete image. Skip its first enter transition.
  if (status === 'loaded' && isInitialRead) {
    setMounted(true);
  }
  imageLoadingStatus.value = status;
}

onMounted(readRenderedImage);
onUpdated(readRenderedImage);

defineExpose({ element });
</script>

<template>
  <slot
    v-if="(keepMounted || mounted) && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="keepMounted || mounted" v-bind="elementProps()" :ref="setRef" />
</template>
