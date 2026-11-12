import AvatarFallback from './fallback/AvatarFallback.vue';
import type { AvatarFallbackProps, AvatarFallbackState } from './fallback/AvatarFallback.vue';
import AvatarImage from './image/AvatarImage.vue';
import type { AvatarImageProps, AvatarImageState } from './image/AvatarImage.vue';
import AvatarRoot from './root/AvatarRoot.vue';
import type { AvatarRootProps, AvatarRootState } from './root/AvatarRoot.vue';

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
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 */
export const Image: typeof AvatarImage = AvatarImage;
export namespace Image {
  export type Props = AvatarImageProps;
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
