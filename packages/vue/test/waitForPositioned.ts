import { waitFor } from '@testing-library/dom';
import { expect } from 'vitest';

/**
 * Waits until the positioner has its first position. Before that pass, the positioner has
 * `opacity: 0`, and `toBeVisible()` refuses an element with that opacity.
 */
export async function waitForPositioned(positioner: HTMLElement) {
  await waitFor(() => {
    expect(positioner).toBeVisible();
  });
}
