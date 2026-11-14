import { platform } from '../../common/platform';

export function stopEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

// License: https://github.com/adobe/react-spectrum/blob/main/packages/@react-aria/utils/src/isVirtualEvent.ts
export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
  if ((event as PointerEvent).pointerType === '' && event.isTrusted) {
    return true;
  }

  if (platform.os.android && (event as PointerEvent).pointerType) {
    return event.type === 'click' && event.buttons === 1;
  }

  return event.detail === 0 && !(event as PointerEvent).pointerType;
}

export function isVirtualPointerEvent(event: PointerEvent) {
  if (platform.env.jsdom) {
    return false;
  }
  return (
    (!platform.os.android && event.width === 0 && event.height === 0) ||
    // Chrome sends a screen reader press (TalkBack, VoiceOver, NVDA) as a 1x1 mouse `pointerdown`
    // with no pressure. A desktop mouse press can also report no pressure. Thus, off Android, the
    // event must have no pressed button. TalkBack can report a pressed button.
    (event.type === 'pointerdown' &&
      event.width === 1 &&
      event.height === 1 &&
      event.pressure === 0 &&
      event.detail === 0 &&
      event.pointerType === 'mouse' &&
      (platform.os.android || event.buttons === 0)) ||
    // iOS VoiceOver gives 0.333 for width and height.
    (event.width < 1 &&
      event.height < 1 &&
      event.pressure === 0 &&
      event.detail === 0 &&
      event.pointerType === 'touch')
  );
}

export function isMouseLikePointerType(pointerType: string | undefined, strict?: boolean) {
  // Chromium on some Linux machines gives the `pointerType` "pen" for a mouse:
  // https://github.com/floating-ui/floating-ui/issues/2015
  const values: (string | undefined)[] = ['mouse', 'pen'];
  if (!strict) {
    values.push('', undefined);
  }
  return values.includes(pointerType);
}

export function isClickLikeEvent(event: Event) {
  const type = event.type;
  return type === 'click' || type === 'mousedown' || type === 'keydown' || type === 'keyup';
}
