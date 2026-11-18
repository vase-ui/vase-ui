import { onMounted, shallowRef, toValue, watch } from 'vue';
import type { ImgHTMLAttributes, MaybeRefOrGetter, Ref } from 'vue';
import type { ImageLoadingStatus } from '../root/AvatarRoot.vue';

interface UseImageLoadingStatusOptions {
  referrerPolicy?: ImgHTMLAttributes['referrerpolicy'] | undefined;
  crossOrigin?: ImgHTMLAttributes['crossorigin'] | undefined;
  sizes?: ImgHTMLAttributes['sizes'] | undefined;
  srcSet?: ImgHTMLAttributes['srcset'] | undefined;
}

/**
 * Loads the image in a detached `Image` and reports its status. The status is `'idle'` until the
 * component mounts, so the server HTML and the first client render are equal.
 */
export function useImageLoadingStatus(
  src: MaybeRefOrGetter<string | undefined>,
  options: MaybeRefOrGetter<UseImageLoadingStatusOptions>,
  enabled: MaybeRefOrGetter<boolean>,
): [Readonly<Ref<ImageLoadingStatus>>, (status: ImageLoadingStatus) => void] {
  const status = shallowRef<ImageLoadingStatus>('idle');

  function setStatus(nextStatus: ImageLoadingStatus) {
    status.value = nextStatus;
  }

  onMounted(() => {
    // The default flush changes the status before the render that the new source causes.
    watch(
      [
        () => toValue(enabled),
        () => toValue(src),
        () => toValue(options).srcSet,
        () => toValue(options).sizes,
        () => toValue(options).crossOrigin,
        () => toValue(options).referrerPolicy,
      ],
      ([isEnabled, source, srcSet, sizes, crossOrigin, referrerPolicy], _previous, onCleanup) => {
        if (!isEnabled) {
          return;
        }

        if (!source && !srcSet) {
          setStatus('error');
          return;
        }

        const image = new Image();
        image.onload = () => setStatus('loaded');
        image.onerror = () => setStatus('error');
        onCleanup(() => {
          image.onload = null;
          image.onerror = null;
        });
        if (referrerPolicy) {
          image.referrerPolicy = referrerPolicy;
        }
        image.crossOrigin = crossOrigin ?? null;
        if (sizes) {
          image.sizes = sizes;
        }
        if (srcSet) {
          image.srcset = srcSet;
        }
        if (source) {
          image.src = source;
        }

        // A cached or decoded image is complete at once. Each run writes the status one time. React
        // batches the writes of a layout effect. Here each write reaches `useTransitionStatus`, so a
        // `'loading'` write before a `'loaded'` write would start an exit on a visible image.
        if (!image.complete) {
          setStatus('loading');
        } else {
          setStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
        }
      },
      { immediate: true },
    );
  });

  return [status, setStatus];
}
