import { onMounted, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { ImgHTMLAttributes, MaybeRefOrGetter, Ref } from 'vue';
import { NOOP } from '../../internals/noop';
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

  let cancelProbe = NOOP;

  function probe() {
    cancelProbe();
    cancelProbe = NOOP;

    if (!toValue(enabled)) {
      return;
    }

    const { referrerPolicy, crossOrigin, sizes, srcSet } = toValue(options);
    const source = toValue(src);

    if (!source && !srcSet) {
      setStatus('error');
      return;
    }

    let isCurrent = true;
    cancelProbe = () => {
      isCurrent = false;
    };

    const image = new Image();

    const updateStatus = (nextStatus: ImageLoadingStatus) => () => {
      if (isCurrent) {
        setStatus(nextStatus);
      }
    };

    image.onload = updateStatus('loaded');
    image.onerror = updateStatus('error');
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
  }

  onMounted(probe);
  // The default flush runs before the render, so the status changes before the render that the
  // new source causes.
  watch(
    [
      () => toValue(enabled),
      () => toValue(src),
      () => toValue(options).srcSet,
      () => toValue(options).sizes,
      () => toValue(options).crossOrigin,
      () => toValue(options).referrerPolicy,
    ],
    probe,
  );
  onScopeDispose(() => cancelProbe());

  return [status, setStatus];
}
