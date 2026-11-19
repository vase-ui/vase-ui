import type { Dimensions } from '@floating-ui/utils';
import { positionerVars } from '../../../internals/useAnchorPositioning';

export function popupSizeStyles(size: Dimensions | 'auto' | null) {
  return (
    size && {
      '--popup-width': size === 'auto' ? size : `${size.width}px`,
      '--popup-height': size === 'auto' ? size : `${size.height}px`,
    }
  );
}

export function positionerSizeStyles(size: Dimensions | null) {
  return (
    size && {
      [positionerVars.positionerWidth]: `${size.width}px`,
      [positionerVars.positionerHeight]: `${size.height}px`,
    }
  );
}
