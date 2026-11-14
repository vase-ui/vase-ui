import { platform } from '../../../common/platform';
import { visuallyHidden } from '../../../common/visuallyHidden';

/**
 * Tells if a focus guard has the form of a button. Call it only in a browser, after the mount.
 */
export function isFocusGuardButton(): boolean {
  // Unlike the cursor of NVDA and JAWS, the cursor of VoiceOver moves the focus. In WebKit it moves
  // the focus only to a focusable element that has `role="button"`. With that role, the focus trap
  // catches the cursor.
  return platform.screenReader.voiceOver && platform.engine.webkit;
}

/**
 * Gives the attributes of a focus guard. `FocusGuard.vue` binds them, and
 * `createFocusGuardElement` writes them to the element that it makes.
 */
export function getFocusGuardAttributes(isButton: boolean) {
  return {
    style: visuallyHidden,
    tabindex: 0,
    role: isButton ? 'button' : undefined,
    'aria-hidden': isButton ? undefined : true,
    // Without a name, axe reports the button: https://github.com/mui/base-ui/issues/5237
    'aria-label': isButton ? 'Focus guard' : undefined,
    'data-vase-ui-focus-guard': '',
  };
}
