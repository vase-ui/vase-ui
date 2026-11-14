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
  // eslint-disable-next-line no-restricted-globals -- A helper of the tests. The cases dispatch their events in the document of the test page.
  const page = document;
  const view = page.defaultView!;
  const legacyDocument = page as unknown as Partial<LegacyTouchDocument>;

  // WebKit has no `Touch` constructor. It has the factory methods `createTouch` and
  // `createTouchList`, and its `TouchEvent` constructor takes only a `TouchList`.
  if (legacyDocument.createTouch && legacyDocument.createTouchList) {
    const { createTouch, createTouchList } = legacyDocument;
    return {
      changedTouches: createTouchList.call(
        page,
        ...touches.map((touch) =>
          createTouch.call(
            page,
            view,
            page.body,
            touch.identifier,
            touch.clientX + view.scrollX,
            touch.clientY + view.scrollY,
            touch.clientX,
            touch.clientY,
          ),
        ),
      ),
    };
  }

  return {
    changedTouches: touches.map((touch) => new Touch({ target: page.body, ...touch })),
  };
}

export function getHorizontalSliderRect(width = 100) {
  return new DOMRect(0, 0, width, 10);
}
