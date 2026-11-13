import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import PositionerPart from '../../test/fixtures/PositionerPart.vue';
import { useAnchorPositioning } from './useAnchorPositioning';

const autoUpdateSpy = vi.hoisted(() => vi.fn());

vi.mock('@floating-ui/vue', async () => {
  const actual = await vi.importActual<typeof import('@floating-ui/vue')>('@floating-ui/vue');

  return {
    ...actual,
    autoUpdate: ((...args: Parameters<typeof actual.autoUpdate>) => {
      autoUpdateSpy(...args);
      return actual.autoUpdate(...args);
    }) satisfies typeof actual.autoUpdate,
  };
});

const BEFORE_POSITION =
  'position:fixed;top:0;left:0;--available-width:100vw;--available-height:100vh;opacity:0;';

describe('useAnchorPositioning', () => {
  it('renders the positioner of an open popup on a server, with the style of a popup that has no position', async () => {
    const html = await renderToString(<PositionerPart mounted side="inline-end" align="start" />);

    expect(typeof document).toBe('undefined');
    expect(html).toBe(
      `<div data-open data-side="inline-end" data-align="start" role="presentation" style="${BEFORE_POSITION}"><!--[--><!--]--></div>`,
    );
    expect(autoUpdateSpy).not.toHaveBeenCalled();
  });

  it('calls no getter of an element on a server', async () => {
    const anchor = vi.fn(() => null);
    const collisionBoundary = vi.fn(() => null);
    const Test = defineComponent(() => {
      const positioning = useAnchorPositioning({
        anchor,
        collisionBoundary,
        mounted: true,
        collisionAvoidance: { fallbackAxisSide: 'end' },
        positionerElement: shallowRef(null),
      });
      return () => <div style={positioning.positionerStyles.value} />;
    });

    const html = await renderToString(<Test />);

    expect(html).toBe(`<div style="${BEFORE_POSITION}"></div>`);
    expect(anchor).not.toHaveBeenCalled();
    expect(collisionBoundary).not.toHaveBeenCalled();
  });
});
