type Touches = Pick<Touch, 'identifier' | 'clientX' | 'clientY'>[];

interface LegacyTouchDocument {
  createTouch: (
    view: Window,
    target: EventTarget,
    identifier: number,
    pageX: number,
    pageY: number,
    screenX: number,
    screenY: number,
  ) => Touch;
  createTouchList: (...touches: Touch[]) => TouchList;
}

export function createTouches(touches: Touches) {
  const legacyDocument = document as unknown as Partial<LegacyTouchDocument>;

  // WebKit has no `Touch` constructor. It has the factory methods `createTouch` and
  // `createTouchList`, and its `TouchEvent` constructor takes only a `TouchList`.
  if (legacyDocument.createTouch && legacyDocument.createTouchList) {
    const { createTouch, createTouchList } = legacyDocument;
    return {
      changedTouches: createTouchList.call(
        document,
        ...touches.map((touch) =>
          createTouch.call(
            document,
            window,
            document.body,
            touch.identifier,
            touch.clientX + window.scrollX,
            touch.clientY + window.scrollY,
            touch.clientX,
            touch.clientY,
          ),
        ),
      ),
    };
  }

  return {
    changedTouches: touches.map((touch) => new Touch({ target: document.body, ...touch })),
  };
}

export function getHorizontalSliderRect(width = 100) {
  return new DOMRect(0, 0, width, 10);
}
