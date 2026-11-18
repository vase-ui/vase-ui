import { describe, expect, it } from 'vitest';
import type { VNode } from 'vue';
import type { createRenderer } from './createRenderer';
import { screen } from './queries';

export function portalOwnPropsTests({ render, createComponent }: PortalOwnPropsTestsConfig) {
  describe('VUE-135: internal portal props', () => {
    it('keeps the portal in the body with an in-place attribute', async () => {
      await render(
        <div data-testid="host">
          {createComponent({ 'in-place': '', 'data-testid': 'portal' })}
        </div>,
      );

      const portal = await screen.findByTestId('portal');
      expect(portal.parentElement).toBe(document.body);
    });
  });
}

export interface PortalOwnPropsTestsConfig {
  /** The render function from `createRenderer`. */
  render: ReturnType<typeof createRenderer>['render'];
  /** Returns the family root with the attributes on its mounted portal part. */
  createComponent: (attributes: Record<string, string>) => VNode;
}
