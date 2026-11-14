import { afterEach, describe, expect, test } from 'vitest';
import { markOthers } from './markOthers';

afterEach(() => {
  document.body.innerHTML = '';
});

test('single call', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  cleanup();

  expect(other.getAttribute('aria-hidden')).toBe(null);
});

test('multiple calls', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  const nextTarget = document.createElement('div');
  document.body.appendChild(nextTarget);

  const nextCleanup = markOthers([nextTarget], { ariaHidden: true });

  expect(target.getAttribute('aria-hidden')).toBe('true');
  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);

  document.body.removeChild(nextTarget);

  nextCleanup();

  expect(target.getAttribute('aria-hidden')).toBe(null);
  expect(other.getAttribute('aria-hidden')).toBe('true');

  cleanup();

  expect(other.getAttribute('aria-hidden')).toBe(null);

  document.body.appendChild(nextTarget);
});

test('out of order cleanup', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  target.setAttribute('data-testid', '');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  const nextTarget = document.createElement('div');
  document.body.appendChild(nextTarget);

  const nextCleanup = markOthers([nextTarget], { ariaHidden: true });

  expect(target.getAttribute('aria-hidden')).toBe('true');
  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);

  cleanup();

  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);
  expect(target.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('aria-hidden')).toBe('true');

  nextCleanup();

  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);
  expect(other.getAttribute('aria-hidden')).toBe(null);
  expect(target.getAttribute('aria-hidden')).toBe(null);
});

test('multiple cleanups with differing controlAttribute', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  target.setAttribute('data-testid', '1');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  const target2 = document.createElement('div');
  target2.setAttribute('data-testid', '2');
  document.body.appendChild(target2);

  const cleanup2 = markOthers([target2]);

  expect(target.getAttribute('aria-hidden')).not.toBe('true');
  expect(target.getAttribute('data-vase-ui-inert')).toBe('');

  cleanup();

  expect(other.getAttribute('aria-hidden')).toBe(null);

  cleanup2();

  expect(target.getAttribute('data-vase-ui-inert')).toBe(null);
});

test('keeps aria-hidden until the last aria-hidden lock releases, alongside marker-only locks', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);

  const A = document.createElement('div');
  document.body.appendChild(A);

  const B = document.createElement('div');
  document.body.appendChild(B);

  const C = document.createElement('div');
  document.body.appendChild(C);

  const cleanupA = markOthers([A], { ariaHidden: true });
  const cleanupB = markOthers([B], { ariaHidden: true });
  const cleanupC = markOthers([C]);

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('data-vase-ui-inert')).toBe('');

  cleanupC();

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('data-vase-ui-inert')).toBe('');

  cleanupB();

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('data-vase-ui-inert')).toBe('');

  cleanupA();

  expect(other.hasAttribute('aria-hidden')).toBe(false);
  expect(other.hasAttribute('data-vase-ui-inert')).toBe(false);
});

test('preserves externally owned aria-hidden during overlapping aria-hidden locks', () => {
  const keep = document.createElement('div');
  const outside = document.createElement('div');
  outside.setAttribute('aria-hidden', 'true');
  document.body.append(keep, outside);

  let cleanupFirst: (() => void) | undefined;
  let cleanupSecond: (() => void) | undefined;

  try {
    cleanupFirst = markOthers([keep], { ariaHidden: true, mark: false });
    cleanupSecond = markOthers([keep], { ariaHidden: true, mark: false });

    expect(outside).toHaveAttribute('aria-hidden', 'true');

    cleanupFirst();
    cleanupFirst = undefined;

    expect(outside).toHaveAttribute('aria-hidden', 'true');

    cleanupSecond();
    cleanupSecond = undefined;

    expect(outside).toHaveAttribute('aria-hidden', 'true');
  } finally {
    cleanupSecond?.();
    cleanupFirst?.();
  }
});

test('does not let mark-only overlap disturb control cleanup bookkeeping', () => {
  const keep = document.createElement('div');
  const outside = document.createElement('div');
  document.body.append(keep, outside);

  let cleanupMarkOnly: (() => void) | undefined;
  let cleanupControlOnly: (() => void) | undefined;

  try {
    cleanupMarkOnly = markOthers([keep], { mark: true });
    cleanupControlOnly = markOthers([keep], { ariaHidden: true, mark: false });

    expect(outside).toHaveAttribute('data-vase-ui-inert');
    expect(outside).toHaveAttribute('aria-hidden', 'true');

    cleanupMarkOnly();
    cleanupMarkOnly = undefined;

    expect(outside).not.toHaveAttribute('data-vase-ui-inert');
    expect(outside).toHaveAttribute('aria-hidden', 'true');

    cleanupControlOnly();
    cleanupControlOnly = undefined;

    expect(outside).not.toHaveAttribute('data-vase-ui-inert');
    expect(outside).not.toHaveAttribute('aria-hidden');
  } finally {
    cleanupControlOnly?.();
    cleanupMarkOnly?.();
  }
});

test('re-reads externally owned aria-hidden once every lock has released', () => {
  const keep = document.createElement('div');
  const outside = document.createElement('div');
  document.body.append(keep, outside);

  const cleanupFirst = markOthers([keep], { ariaHidden: true });
  expect(outside).toHaveAttribute('aria-hidden', 'true');
  cleanupFirst();
  expect(outside).not.toHaveAttribute('aria-hidden');

  outside.setAttribute('aria-hidden', 'true');
  const cleanupSecond = markOthers([keep], { ariaHidden: true });
  cleanupSecond();
  expect(outside).toHaveAttribute('aria-hidden', 'true');

  outside.removeAttribute('aria-hidden');
  const cleanupThird = markOthers([keep], { ariaHidden: true });
  expect(outside).toHaveAttribute('aria-hidden', 'true');
  cleanupThird();
  expect(outside).not.toHaveAttribute('aria-hidden');
});

test('re-reads externally owned aria-hidden while an unrelated lock stays held', () => {
  const keep = document.createElement('div');
  const outside = document.createElement('div');
  outside.setAttribute('aria-hidden', 'true');
  document.body.append(keep, outside);

  // Keeps the lock count above zero so the bookkeeping is never reset wholesale.
  const cleanupHeld = markOthers([keep, outside], { ariaHidden: true });

  try {
    const cleanupFirst = markOthers([keep], { ariaHidden: true });
    cleanupFirst();
    expect(outside).toHaveAttribute('aria-hidden', 'true');

    outside.removeAttribute('aria-hidden');
    const cleanupSecond = markOthers([keep], { ariaHidden: true });
    expect(outside).toHaveAttribute('aria-hidden', 'true');
    cleanupSecond();
    expect(outside).not.toHaveAttribute('aria-hidden');
  } finally {
    cleanupHeld();
  }
});

test('leaves live regions, their ancestors, and scripts exposed', () => {
  const keep = document.createElement('div');
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  const liveWrapper = document.createElement('div');
  const nestedLiveRegion = document.createElement('div');
  nestedLiveRegion.setAttribute('aria-live', 'assertive');
  const liveSibling = document.createElement('div');
  liveWrapper.append(nestedLiveRegion, liveSibling);
  const script = document.createElement('script');
  document.body.append(keep, liveRegion, liveWrapper, script);

  const cleanup = markOthers([keep], { ariaHidden: true, mark: false });

  expect(liveRegion).not.toHaveAttribute('aria-hidden');
  expect(liveWrapper).not.toHaveAttribute('aria-hidden');
  expect(nestedLiveRegion).not.toHaveAttribute('aria-hidden');
  expect(liveSibling).toHaveAttribute('aria-hidden', 'true');
  expect(script).not.toHaveAttribute('aria-hidden');

  cleanup();

  expect(liveSibling).not.toHaveAttribute('aria-hidden');
});

test('does not recurse infinitely with target inside anchor in shadow root', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const anchor = document.createElement('a');
  anchor.href = 'https://floating-ui.com';

  const target = document.createElement('button');
  anchor.appendChild(target);
  shadowRoot.appendChild(anchor);

  // Infinite recursion would throw a RangeError here instead of returning.
  const cleanup = markOthers([target], { ariaHidden: true });

  // The host contains the target, so it must not have been hidden.
  expect(host).not.toHaveAttribute('aria-hidden');

  cleanup();
});

test('uses shadow root host as avoid element when parent chain includes anchor', () => {
  const outside = document.createElement('div');
  document.body.appendChild(outside);

  const host = document.createElement('div');
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const anchor = document.createElement('a');
  anchor.href = 'https://floating-ui.com';

  const target = document.createElement('button');
  anchor.appendChild(target);
  shadowRoot.appendChild(anchor);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(outside.getAttribute('aria-hidden')).toBe('true');
  expect(host.getAttribute('aria-hidden')).toBe(null);

  cleanup();

  expect(outside.getAttribute('aria-hidden')).toBe(null);
});

test('gives inert to the elements that ariaHidden hides, and keeps an inert of the page', () => {
  const keep = document.createElement('div');
  const main = document.createElement('main');
  const liveWrapper = document.createElement('div');
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveWrapper.append(liveRegion);
  const script = document.createElement('script');
  const inertBefore = document.createElement('div');
  inertBefore.inert = true;
  document.body.append(keep, main, liveWrapper, script, inertBefore);

  const cleanup = markOthers([keep], { ariaHidden: true, inert: true, mark: false });

  expect(main).toHaveAttribute('aria-hidden', 'true');
  expect(main).toHaveAttribute('inert');
  expect(keep).not.toHaveAttribute('inert');
  expect(liveWrapper).not.toHaveAttribute('inert');
  expect(liveRegion).not.toHaveAttribute('inert');
  expect(script).not.toHaveAttribute('inert');

  cleanup();

  expect(main).not.toHaveAttribute('aria-hidden');
  expect(main).not.toHaveAttribute('inert');
  expect(inertBefore).toHaveAttribute('inert');
});

test('shares the marks with a second copy of the module', async () => {
  const copy: typeof import('./markOthers') = await import('./markOthers?copy' as string);
  expect(copy.markOthers).not.toBe(markOthers);
  const keep = document.createElement('div');
  const outside = document.createElement('div');
  document.body.append(keep, outside);

  const cleanupFirst = markOthers([keep], { ariaHidden: true });
  const cleanupSecond = copy.markOthers([keep], { ariaHidden: true });
  cleanupFirst();

  expect(outside).toHaveAttribute('aria-hidden', 'true');
  expect(outside).toHaveAttribute('data-vase-ui-inert');

  cleanupSecond();

  expect(outside).not.toHaveAttribute('aria-hidden');
  expect(outside).not.toHaveAttribute('data-vase-ui-inert');
});

describe('BUG-5577: a lock that is taken later, in a container that an older lock marked', () => {
  // `container` is beside the element of the older lock. It holds `other`, and a `wrapper` with the
  // element of the later lock and its `sibling`.
  function renderPage() {
    const page = document.createElement('main');
    const older = document.createElement('div');
    const container = document.createElement('div');
    const other = document.createElement('div');
    const wrapper = document.createElement('div');
    const later = document.createElement('div');
    const sibling = document.createElement('div');
    wrapper.append(later, sibling);
    container.append(other, wrapper);
    document.body.append(page, older, container);
    return { page, older, container, other, wrapper, later, sibling };
  }

  const attributes = ['aria-hidden', 'inert', 'data-vase-ui-inert'];
  const marked = (element: Element) => attributes.filter((name) => element.hasAttribute(name));

  test('lifts the attributes of the older lock from its elements and their ancestors', () => {
    const { page, older, container, other, wrapper, later, sibling } = renderPage();
    const cleanupOlder = markOthers([older], { ariaHidden: true, inert: true });
    expect(marked(container)).toEqual(attributes);

    const cleanupLater = markOthers([later]);

    expect([container, wrapper, later].map(marked)).toEqual([[], [], []]);
    expect([page, other, sibling].map(marked)).toEqual([attributes, attributes, attributes]);
    expect(marked(older)).toEqual(['data-vase-ui-inert']);

    cleanupLater();

    expect(marked(container)).toEqual(attributes);
    expect([older, other, wrapper, sibling].map(marked)).toEqual([[], [], [], []]);

    cleanupOlder();

    expect([page, container].map(marked)).toEqual([[], []]);
  });

  test('keeps no attribute of the older lock that releases first', () => {
    const { page, older, container, other, later, sibling } = renderPage();
    const cleanupOlder = markOthers([older], { ariaHidden: true, inert: true });
    const cleanupLater = markOthers([later]);

    cleanupOlder();

    expect(marked(container)).toEqual([]);
    expect([page, older, other, sibling].map(marked)).toEqual([
      ['data-vase-ui-inert'],
      ['data-vase-ui-inert'],
      ['data-vase-ui-inert'],
      ['data-vase-ui-inert'],
    ]);

    cleanupLater();

    expect([page, older, other, sibling].map(marked)).toEqual([[], [], [], []]);
  });
});
