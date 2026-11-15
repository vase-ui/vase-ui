import { screen } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import type { Component, Slots, VNode } from 'vue';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { isVaporApp } from '../testApp';
import VaporConsumer from './VaporConsumer.vue';

type ComponentWithElement = { element: Element | null };

/** The default slot of the vnode as a component that a template can render. */
function contentOf({ children }: VNode): Component | undefined {
  const slot = (children as Slots | null)?.default;
  return slot && (() => slot());
}

export function testVaporConsumer(element: VNode, getOptions: () => VaseUiConformanceTestsOptions) {
  // Only the project `vapor` mounts the test in an app that can render a Vapor component.
  if (!isVaporApp) {
    return;
  }
  const {
    render,
    testRenderPropWith: tag = 'div',
    button = false,
    childrenSelector,
  } = getOptions();

  async function renderConsumer(
    form: 'as' | 'render' | 'render-without-ref',
  ): Promise<ComponentWithElement | null> {
    let part: ComponentWithElement | null = null;
    await render(
      <VaporConsumer
        part={element.type as Component}
        content={contentOf(element)}
        partProps={{
          ...element.props,
          'data-testid': 'root',
          ...(button && { nativeButton: tag === 'button' }),
        }}
        tag={tag}
        form={form}
        onPart={(value: unknown) => {
          part = value as ComponentWithElement | null;
        }}
      />,
    );
    return part;
  }

  describe('Vapor consumer', () => {
    it('is compiled in Vapor mode', () => {
      expect((VaporConsumer as { __vapor?: boolean }).__vapor).toBe(true);
    });

    it('renders the element of `as` and exposes it', async () => {
      const part = await renderConsumer('as');
      const root = screen.getByTestId('root');
      expect(root.tagName).toBe(tag.toUpperCase());
      expect(part?.element).toBe(root);
    });

    it('gives the part the element of `#render` through `:ref="props.ref"`', async () => {
      const part = await renderConsumer('render');
      const root = screen.getByTestId('root');
      expect(root.tagName).toBe(tag.toUpperCase());
      expect(part?.element).toBe(root);
    });

    if (childrenSelector !== undefined) {
      it('mounts the nodes of the part through `children`', async () => {
        await renderConsumer('render');
        expect(screen.getByTestId('root').querySelector(childrenSelector)).not.toBe(null);
      });
    }

    it('warns when `#render` binds `props` with no `:ref`', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const part = await renderConsumer('render-without-ref');
      expect(part?.element).toBe(null);
      const messages = warnSpy.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('The `#render` slot gave no element'));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('`:ref="props.ref"`');
    });
  });
}
