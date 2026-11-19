import AvatarFallback from './AvatarFallback.vue';
import AvatarImage from './AvatarImage.vue';
import AvatarRoot from './AvatarRoot.vue';

// The API reference of the docs reads the description of a part from the JSDoc of its export.

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 */
export const Root: typeof AvatarRoot = AvatarRoot;

/**
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 */
export const Image: typeof AvatarImage = AvatarImage;

/**
 * Rendered when the image fails to load or when no image is provided.
 * Renders a `<span>` element.
 */
export const Fallback: typeof AvatarFallback = AvatarFallback;
