import { nextTick, ref } from 'vue';

export type DemoVariant = 'css-modules' | 'tailwind';

/** The key of `localStorage` that keeps the variant. A script in the head of each page reads it. */
export const DEMO_VARIANT_STORAGE_KEY = 'vase-ui-demo-variant';

/**
 * The variant that each demo of the site shows. The server renders the default, and the first
 * render in the browser must give the same HTML. Only the two functions below write the value.
 */
export const demoVariant = ref<DemoVariant>('css-modules');

/** Takes the variant that the script in the head read from the storage. Call it after the mount. */
export function restoreDemoVariant(): void {
  if (document.documentElement.dataset.demoVariant === 'tailwind') {
    demoVariant.value = 'tailwind';
  }
}

/** Shows `variant` in each demo and keeps the choice. `control` keeps its place in the window. */
export async function selectDemoVariant(variant: DemoVariant, control: Element): Promise<void> {
  const { top } = control.getBoundingClientRect();
  demoVariant.value = variant;
  if (variant === 'tailwind') {
    document.documentElement.dataset.demoVariant = variant;
  } else {
    delete document.documentElement.dataset.demoVariant;
  }
  try {
    localStorage.setItem(DEMO_VARIANT_STORAGE_KEY, variant);
  } catch {
    // A browser can refuse the storage. The choice then lasts until the page loads again.
  }
  // The demos above the control can change their height.
  await nextTick();
  await new Promise<number>((resolve) => {
    requestAnimationFrame(resolve);
  });
  scrollBy({ top: control.getBoundingClientRect().top - top, behavior: 'instant' });
}
