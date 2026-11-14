import ToastContent from './content/ToastContent.vue';
import type { ToastContentProps, ToastContentState } from './content/ToastContent.vue';
import ToastPortal from './portal/ToastPortal.vue';
import type { ToastPortalProps, ToastPortalState } from './portal/ToastPortal.vue';
import ToastProvider from './provider/ToastProvider.vue';
import type { ToastProviderProps, ToastProviderState } from './provider/ToastProvider.vue';
import ToastRoot from './root/ToastRoot.vue';
import type { ToastRootProps, ToastRootState, ToastRootToastObject } from './root/ToastRoot.vue';
import ToastViewport from './viewport/ToastViewport.vue';
import type { ToastViewportProps, ToastViewportState } from './viewport/ToastViewport.vue';

/**
 * Provides a context for creating and managing toasts.
 * Doesn't render its own HTML element.
 */
export const Provider: typeof ToastProvider = ToastProvider;
export namespace Provider {
  export type State = ToastProviderState;
  export type Props = ToastProviderProps;
}

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Viewport: typeof ToastViewport = ToastViewport;
export namespace Viewport {
  export type State = ToastViewportState;
  export type Props = ToastViewportProps;
}

/**
 * Groups all parts of an individual toast.
 * Renders a `<div>` element.
 */
export const Root: typeof ToastRoot = ToastRoot;
export namespace Root {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props = ToastRootProps;
}

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 */
export const Content: typeof ToastContent = ToastContent;
export namespace Content {
  export type State = ToastContentState;
  export type Props = ToastContentProps;
}

/**
 * A portal element that moves the viewport to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof ToastPortal = ToastPortal;
export namespace Portal {
  export type State = ToastPortalState;
  export type Props = ToastPortalProps;
}

export { useToastManager } from './useToastManager';
export { createToastManager } from './createToastManager';
