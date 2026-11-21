import AvatarFallback from './AvatarFallback.vue';
import AvatarImage from './AvatarImage.vue';
import AvatarRoot from './AvatarRoot.vue';
import type {
  AvatarFallbackProps,
  AvatarFallbackState,
  AvatarImageEmits,
  AvatarImageProps,
  AvatarImageState,
  AvatarRootProps,
  AvatarRootState,
} from './types';

// The API reference of the docs reads the description of a part from the JSDoc of its export.

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 */
export const Root: typeof AvatarRoot = AvatarRoot;
export namespace Root {
  export type Props = AvatarRootProps;
  export type State = AvatarRootState;
}

/**
 * The image to be displayed in the avatar. It has `alt=""` when you give no `alt`. Give an `alt`
 * when no text beside the avatar names the person.
 * Renders an `<img>` element.
 * @selector `[data-loading]` The picture loads, and `keepMounted` keeps the image in the DOM.
 * @selector `[data-error]` The picture failed to load, and `keepMounted` keeps the image in the DOM.
 */
export const Image: typeof AvatarImage = AvatarImage;
export namespace Image {
  export type Props = AvatarImageProps;
  export type Emits = AvatarImageEmits;
  export type State = AvatarImageState;
}

/**
 * Rendered when the image fails to load or when no image is provided.
 * Renders a `<span>` element.
 */
export const Fallback: typeof AvatarFallback = AvatarFallback;
export namespace Fallback {
  export type Props = AvatarFallbackProps;
  export type State = AvatarFallbackState;
}
