import { screen } from '../queries';
import { expect, describe, it, vi } from 'vitest';
import type { VNode } from 'vue';
import { cloneElement } from '../cloneElement';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { isVaporParts } from '../testApp';
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
            // The slot mounts `children`, so the part gives only the warning for the ref.
            render: ({ props, children: Children }: any) => (
              <Element
                {...props}
                ref={(value: unknown) => {
                  own = value;
                }}
              >
                {Children && <Children />}
              </Element>
            ),
          },
        );

      await render(<Test />);

      expect(own).toBeInstanceOf(window.HTMLElement);
      expect(component!.element).toBe(null);
      expect(warnSpy.mock.calls).toEqual([
        [expect.stringContaining('The `#render` slot gave no element')],
      ]);
    });

    // Only a part compiled as a Vapor component needs this case, because its slot reads a slot
    // prop only when it uses the prop. Each other part calls `elementProps()` when it renders the
    // slot, and the cases of `useRenderElement` cover that call.
    it.runIf(isVaporParts)('warns when the slot reads no slot prop', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(
        cloneElement(element, { ...(button && { nativeButton }) }, { render: () => <Element /> }),
      );

      // This slot does not mount `children`, so a part with `children` gives a second message.
      // The options do not name each part with `children`, so the case accepts both lists.
      const [first, ...rest] = warnSpy.mock.calls;
      expect(first).toEqual([
        expect.stringContaining('Vase UI: The `#render` slot gave no element to the part.'),
      ]);
      expect(rest).toEqual(
        rest.length === 0
          ? []
          : [[expect.stringContaining('Vase UI: The `#render` slot did not mount `children`.')]],
      );
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
