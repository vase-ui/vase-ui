import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import { KeepAlive, nextTick, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, renderOnServer, wait, waitFor } from '#test-utils';
import AnchoredScrollLockPart from '../../../test/fixtures/AnchoredScrollLockPart.vue';
import {
  createScrollDocument,
  getScrollLockRegistry,
  HIDDEN_SCROLLBARS_CSS,
  isPageLocked,
  recordLockCounts,
} from '../../../test/fixtures/scrollDocument';
import type { ScrollDocument } from '../../../test/fixtures/scrollDocument';

const PART_FILE = 'test/fixtures/AnchoredScrollLockPart.vue';

// The observers of `waitFor` do not see a document in a frame, so it polls.
const POLL = { interval: 5, timeout: 3000 };

function waitForLock(page: ScrollDocument) {
  return waitFor(() => expect(isPageLocked(page)).toBe(true), POLL);
}

function waitForUnlock(page: ScrollDocument) {
  return waitFor(() => expect(isPageLocked(page)).toBe(false), POLL);
}

// Creates a document that has no scrollbar that takes space, so that its viewport is as wide as its
// frame.
async function createPage() {
  const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
  expect(page.win.innerWidth - page.html.clientWidth).toBe(0);
  return page;
}

// An element of the document that is `width` wide, for the positioner of a popup.
function addPositioner({ doc, body }: ScrollDocument, width: number) {
  const positioner = doc.createElement('div');
  positioner.style.cssText = `position: absolute; top: 0; left: 0; width: ${width}px; height: 50px`;
  body.append(positioner);
  return positioner;
}

describe('useAnchoredPopupScrollLock', () => {
  const { render } = createRenderer();

  // The hook runs after the unmount of `createRenderer`. The registry lives for the whole file, so
  // a case that leaves a lock would break each later case.
  afterEach(async () => {
    await wait(0);
    const registry = getScrollLockRegistry();
    expect({ lockCount: registry?.lockCount, restore: registry?.restore }).toEqual({
      lockCount: 0,
      restore: null,
    });
  });

  it('locks the page for an open that is not by touch', async () => {
    const page = await createPage();
    const positioner = addPositioner(page, 100);

    await render(
      <AnchoredScrollLockPart
        enabled
        positionerElement={positioner}
        referenceElement={page.reference}
      />,
    );

    await waitForLock(page);
  });

  it.each([
    { name: 'the viewport', less: 0, locks: true, outcome: 'locks' },
    { name: 'the viewport less 20 px', less: 20, locks: true, outcome: 'locks' },
    { name: 'the viewport less 21 px', less: 21, locks: false, outcome: 'does not lock' },
  ])(
    '$outcome the page for a touch open when the positioner is as wide as $name',
    async ({ less, locks }) => {
      const page = await createPage();
      const positioner = addPositioner(page, page.html.clientWidth - less);

      await render(
        <AnchoredScrollLockPart
          enabled
          touchOpen
          positionerElement={positioner}
          referenceElement={page.reference}
        />,
      );

      if (locks) {
        await waitForLock(page);
      } else {
        await wait(0);
        expect(isPageLocked(page)).toBe(false);
      }
    },
  );

  it('does not lock the page for a touch open with no positioner element', async () => {
    const page = await createPage();

    await render(<AnchoredScrollLockPart enabled touchOpen referenceElement={page.reference} />);
    await wait(0);

    expect(isPageLocked(page)).toBe(false);
  });

  it.each([
    { name: 'a positioner that has no width', frameWidth: 20, positionerWidth: 0 },
    { name: 'a viewport that has no width', frameWidth: 0, positionerWidth: 100 },
  ])(
    'does not lock the page for a touch open with $name',
    async ({ frameWidth, positionerWidth }) => {
      const page = await createPage();
      (page.win.frameElement as HTMLElement).style.width = `${frameWidth}px`;
      expect(page.html.clientWidth).toBe(frameWidth);
      const positioner = addPositioner(page, positionerWidth);

      await render(
        <AnchoredScrollLockPart
          enabled
          touchOpen
          positionerElement={positioner}
          referenceElement={page.reference}
        />,
      );
      await wait(0);

      expect(isPageLocked(page)).toBe(false);
    },
  );

  it('measures the positioner again when the lock becomes enabled', async () => {
    const page = await createPage();
    const positioner = addPositioner(page, page.html.clientWidth);
    const enabled = shallowRef(false);
    await render(() => (
      <AnchoredScrollLockPart
        enabled={enabled.value}
        touchOpen
        positionerElement={positioner}
        referenceElement={page.reference}
      />
    ));
    await wait(0);
    expect(isPageLocked(page)).toBe(false);

    enabled.value = true;
    await nextTick();

    await waitForLock(page);
  });

  it('measures the positioner again when the positioner element changes', async () => {
    const page = await createPage();
    const narrow = addPositioner(page, 100);
    const wide = addPositioner(page, page.html.clientWidth);
    const positioner = shallowRef(narrow);
    await render(() => (
      <AnchoredScrollLockPart
        enabled
        touchOpen
        positionerElement={positioner.value}
        referenceElement={page.reference}
      />
    ));
    await wait(0);
    expect(isPageLocked(page)).toBe(false);

    positioner.value = wide;
    await nextTick();
    await waitForLock(page);

    positioner.value = narrow;
    await nextTick();
    await waitForUnlock(page);
  });

  it('locks one time for a touch open of a wide positioner', async () => {
    const page = await createPage();
    const positioner = addPositioner(page, page.html.clientWidth);
    const writes: (string | null)[] = [];
    const observer = new page.win.MutationObserver((records) => {
      for (const record of records) {
        writes.push(record.oldValue);
      }
    });
    observer.observe(page.html, { attributes: true, attributeOldValue: true });
    observer.observe(page.body, { attributes: true, attributeOldValue: true });
    onTestFinished(() => observer.disconnect());

    await render(
      <AnchoredScrollLockPart
        enabled
        touchOpen
        positionerElement={positioner}
        referenceElement={page.reference}
      />,
    );
    await waitForLock(page);
    await wait(0);
    await flushMicrotasks();

    // The lock writes the overflow of the body for each axis, and nothing puts the page back.
    expect(writes).toEqual([null, 'overflow-y: hidden;']);
  });

  it('keeps the lock when an open that is not by touch becomes a touch open of a wide positioner', async () => {
    const page = await createPage();
    const positioner = addPositioner(page, page.html.clientWidth);
    const touchOpen = shallowRef(false);
    await render(() => (
      <AnchoredScrollLockPart
        enabled
        touchOpen={touchOpen.value}
        positionerElement={positioner}
        referenceElement={page.reference}
      />
    ));
    await waitForLock(page);
    const lockCounts = recordLockCounts();

    touchOpen.value = true;
    await nextTick();
    await wait(0);

    // One flush measures the positioner and then decides on the lock, so the count never changes.
    expect(lockCounts()).toEqual([]);
    expect(isPageLocked(page)).toBe(true);
  });

  it('releases the lock at the deactivation of KeepAlive and takes it again at the activation', async () => {
    const page = await createPage();
    const positioner = addPositioner(page, 100);
    const visible = shallowRef(true);
    await render(() => (
      <KeepAlive>
        {visible.value ? (
          <AnchoredScrollLockPart
            key="part"
            enabled
            positionerElement={positioner}
            referenceElement={page.reference}
          />
        ) : (
          <span key="other" />
        )}
      </KeepAlive>
    ));
    await waitForLock(page);

    visible.value = false;
    await nextTick();
    await waitForUnlock(page);

    visible.value = true;
    await nextTick();
    await waitForLock(page);
  });

  it('unlocks the page when enabled turns false', async () => {
    const page = await createPage();
    const positioner = addPositioner(page, 100);
    const enabled = shallowRef(true);
    await render(() => (
      <AnchoredScrollLockPart
        enabled={enabled.value}
        positionerElement={positioner}
        referenceElement={page.reference}
      />
    ));
    await waitForLock(page);

    enabled.value = false;
    await nextTick();

    await waitForUnlock(page);
  });

  describe('on a server', () => {
    it('renders the part and takes no lock', async () => {
      const html = await renderOnServer(PART_FILE, { enabled: true });

      expect(html).toBe(
        '<div><div role="presentation" data-vase-ui-inert style="position:fixed;inset:0;user-select:none;-webkit-user-select:none;"></div></div>',
      );
    });
  });
});
