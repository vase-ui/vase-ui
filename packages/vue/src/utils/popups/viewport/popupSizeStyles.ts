import type { Dimensions } from '@floating-ui/utils';
import * as PositionerVars from '../positioning/CommonPositionerCssVars';
import * as PopupVars from './CommonPopupCssVars';

export function popupSizeStyles(size: Dimensions | 'auto' | null) {
  return (
    size && {
      [PopupVars.popupWidth]: size === 'auto' ? size : `${size.width}px`,
      [PopupVars.popupHeight]: size === 'auto' ? size : `${size.height}px`,
    }
  );
}

export function positionerSizeStyles(size: Dimensions | null) {
  return (
    size && {
      [PositionerVars.positionerWidth]: `${size.width}px`,
      [PositionerVars.positionerHeight]: `${size.height}px`,
    }
  );
}
