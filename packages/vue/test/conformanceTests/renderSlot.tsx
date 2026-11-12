import { screen } from '@testing-library/dom';
import { expect, describe, it, vi } from 'vitest';
import type { VNode } from 'vue';
import { cloneElement } from '../cloneElement';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { throwMissingPropError } from './utils';

type ComponentWithElement = { element: Element | null };

export function testRenderSlot(element: VNode, getOptions: () => VaseUiConformanceTestsOptions) {
  const {
    render,
    testRenderPropWith: Element = 'div',
    button = false,
    childrenSelector,
  } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  describe('slot: render', () => {
    it('warns when a ref of the consumer replaces the ref of the part', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let component: ComponentWithElement | null = null;
      let own: unknown = null;

      const Test = () =>
        cloneElement(
          element,
          {
            ref: (value: ComponentWithElement | null) => {
              component = value;
            },
            ...(button && { nativeButton }),
          },
          {
            render: ({ props }: any) => (
              <Element
                {...props}
                ref={(value: unknown) => {
                  own = value;
                }}
              />
            ),
          },
        );

      await render(<Test />);

      expect(own).toBeInstanceOf(window.HTMLElement);
      expect(component!.element).toBe(null);
      const messages = warnSpy.mock.calls.map(([message]) => String(message));
      expect(
        messages.filter((message) => message.includes('The `#render` slot gave no element')),
      ).toHaveLength(1);
    });

    if (childrenSelector !== undefined) {
      it('renders the nodes of the part in the children component', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await render(
          cloneElement(
            element,
            { 'data-testid': 'root', ...(button && { nativeButton }) },
            {
              render: ({ props, children: Children }: any) => (
                <Element {...props}>
                  <Children />
                </Element>
              ),
            },
          ),
        );

        expect(screen.getByTestId('root').querySelector(childrenSelector)).not.toBe(null);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('warns when the slot does not mount children', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await render(
          cloneElement(
            element,
            { 'data-testid': 'root', ...(button && { nativeButton }) },
            {
              render: ({ props }: any) => <Element {...props} />,
            },
          ),
        );

        expect(screen.getByTestId('root').querySelector(childrenSelector)).toBe(null);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('The `#render` slot did not mount `children`');
      });
    }
  });
}
