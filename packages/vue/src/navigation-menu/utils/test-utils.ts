import { onTestFinished, vi } from 'vitest';

export const TOP_LEVEL_VIEWPORT_WARNING =
  'Vase UI: <NavigationMenu.Viewport> of a top-level <NavigationMenu.Root> is not inside <NavigationMenu.Positioner>. ' +
  'A top-level root with no positioner does not close on Escape, on a click outside or on a second click on its trigger. ' +
  'Put the viewport inside <NavigationMenu.Portal>, <NavigationMenu.Positioner> and <NavigationMenu.Popup>. Only a nested root can have a viewport with no positioner.';

/**
 * Allows the warning for a viewport with no positioner in a root that is not nested. The test still
 * fails on each other call of `console.warn`. Call it before the mount, in a test or in a
 * `beforeEach` hook.
 */
export function allowTopLevelViewportWarning() {
  const otherCalls: unknown[][] = [];
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (args[0] !== TOP_LEVEL_VIEWPORT_WARNING) {
      otherCalls.push(args);
    }
  });
  onTestFinished(() => {
    if (otherCalls.length > 0) {
      throw new Error(
        `The test gave warnings that it did not expect.\n\n${otherCalls.map((args) => args.join(' ')).join('\n')}`,
      );
    }
  });
}
