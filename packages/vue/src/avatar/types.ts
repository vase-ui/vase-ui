import type { HTMLAttributes, ImgHTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AvatarRootState {
  /**
   * The image loading status.
   */
  imageLoadingStatus: ImageLoadingStatus;
}

export interface AvatarImageProps extends /* @vue-ignore */ Omit<
  ImgHTMLAttributes,
  'crossorigin' | 'referrerpolicy' | 'sizes' | 'src' | 'srcset'
> {
  /**
   * The URL of the image.
   */
  src?: string;
  /**
   * The candidate sources of the image, as in the `srcset` attribute of `<img>`.
   */
  srcset?: string;
  /**
   * The display sizes of the image, as in the `sizes` attribute of `<img>`.
   */
  sizes?: string;
  /**
   * The CORS setting of the image request, as in the `crossorigin` attribute of `<img>`.
   */
  crossorigin?: 'anonymous' | 'use-credentials' | '';
  /**
   * The referrer policy of the image request, as in the `referrerpolicy` attribute of `<img>`.
   */
  referrerpolicy?: ReferrerPolicy;
  /**
   * Whether the image element stays in the DOM and loads the picture in place. Supports
   * `loading="lazy"` and an image component that renders its own `<img>`.
   * @default false
   */
  keepMounted?: boolean;
}

export type AvatarImageState = AvatarRootState;

export interface AvatarFallbackProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   * @default 0
   */
  delay?: number;
}

export type AvatarFallbackState = AvatarRootState;
