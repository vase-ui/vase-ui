import { onMounted, onUnmounted, shallowRef } from 'vue';

/**
 * `true` from one task after the mount. A live region renders its content then: a screen reader
 * announces a change of a live region, and a region that comes with its content can stay silent
 * (MDN, ARIA live regions).
 */
export function useLiveRegionReady() {
  const ready = shallowRef(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onMounted(() => {
    timer = setTimeout(() => (ready.value = true));
  });
  onUnmounted(() => clearTimeout(timer));
  return ready;
}
