import { screen } from '@testing-library/dom';
import { expect, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { cloneElement } from '../cloneElement';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { randomStringValue } from '../randomStringValue';
import { childrenSlots, throwMissingPropError } from './utils';

type ComponentWithElement = { element: Element | null };

export function testRenderProp(element: VNode, getOptions: () => VaseUiConformanceTestsOptions) {
  const {
    render,
    testRenderPropWith: Element = 'div',
    button = false,
    wrappingAllowed = true,
  } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  // Vue has no ref forwarding. A wrapper that renders the element of the part inside another element
  // exposes the inner element as `element`. Vue sets the template ref of the inner element after the
  // render of the wrapper.
  const Wrapper = defineComponent({
    name: 'Wrapper',
    inheritAttrs: false,
    setup(_, { attrs, expose, slots }) {
      const inner = shallowRef<Element | null>(null);
      expose({ element: inner });
      return () =>
        wrappingAllowed ? (
          <div data-testid="vase-ui-wrapper">
            <Element {...attrs} ref={inner} data-testid="wrapped" v-slots={slots} />
          </div>
        ) : (
          <Element {...attrs} ref={inner} data-testid="wrapped" v-slots={slots} />
        );
    },
  });

  describe('prop: render', () => {
    it('renders a customized root element with a function', async () => {
      const testValue = randomStringValue();

      await render(
        cloneElement(
          element,
          { ...(button && { nativeButton }) },
          {
            render: ({ props, children }: any) => (
              <Wrapper {...props} data-test-value={testValue} v-slots={childrenSlots(children)} />
            ),
          },
        ),
      );

      expect(screen.queryAllByTestId('vase-ui-wrapper')).toHaveLength(wrappingAllowed ? 1 : 0);
      expect(screen.queryByTestId('wrapped')).not.toBe(null);
      expect(screen.queryByTestId('wrapped')).toHaveAttribute('data-test-value', testValue);
    });

    it('renders a customized root element with an element', async () => {
      const testValue = randomStringValue();

      await render(
        cloneElement(element, {
          as: Wrapper,
          'data-test-value': testValue,
          ...(button && { nativeButton }),
        }),
      );

      expect(screen.queryAllByTestId('vase-ui-wrapper')).toHaveLength(wrappingAllowed ? 1 : 0);
      expect(screen.queryByTestId('wrapped')).not.toBe(null);
      expect(screen.queryByTestId('wrapped')).toHaveAttribute('data-test-value', testValue);
    });

    it('should pass the ref to the custom component', async () => {
      let component: ComponentWithElement | null = null;

      const Test = () =>
        cloneElement(
          element,
          {
            ref: (value: ComponentWithElement | null) => {
              component = value;
            },
            'data-testid': 'wrapped',
            ...(button && { nativeButton }),
          },
          {
            render: ({ props, children }: any) => (
              <Wrapper {...props} v-slots={childrenSlots(children)} />
            ),
          },
        );

      await render(<Test />);

      const instanceFromRef = component!.element;
      expect(instanceFromRef!.tagName).toBe(Element.toUpperCase());
      expect(instanceFromRef!).toHaveAttribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element ref with the custom component ref', async () => {
      let componentA: ComponentWithElement | null = null;
      let componentB: ComponentWithElement | null = null;

      const Test = () =>
        cloneElement(
          element,
          {
            ref: (value: ComponentWithElement | null) => {
              componentA = value;
            },
            'data-testid': 'wrapped',
            ...(button && { nativeButton }),
          },
          {
            // `ref` is not merged. A `ref` on the element of the slot replaces the setter of the
            // part, so the own ref of the element calls `props.ref` itself.
            render: ({ props, children }: any) => (
              <Wrapper
                {...props}
                ref={(value: ComponentWithElement | null) => {
                  props.ref(value);
                  componentB = value;
                }}
                v-slots={childrenSlots(children)}
              />
            ),
          },
        );

      await render(<Test />);

      const refA = componentA!.element;
      const refB = componentB!.element;
      expect(refA).not.toBe(null);
      expect(refA!.tagName).toBe(Element.toUpperCase());
      expect(refA!).toHaveAttribute('data-testid', 'wrapped');
      expect(refB).not.toBe(null);
      expect(refB!.tagName).toBe(Element.toUpperCase());
      expect(refB!).toHaveAttribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element className with the custom component className', async () => {
      const Test = () =>
        cloneElement(
          element,
          {
            class: 'component-classname',
            'data-testid': 'test-component',
            ...(button && { nativeButton }),
          },
          {
            render: ({ props, children }: any) => (
              <Element {...props} class="render-prop-classname" v-slots={childrenSlots(children)} />
            ),
          },
        );

      await render(<Test />);

      const component = screen.getByTestId('test-component');
      expect(component.classList.contains('component-classname')).toBe(true);
      expect(component.classList.contains('render-prop-classname')).toBe(true);
    });

    it('should merge the rendering element resolved className with the custom component className', async () => {
      const Test = () =>
        cloneElement(
          element,
          {
            stateClass: () => 'conditional-component-classname',
            'data-testid': 'test-component',
            ...(button && { nativeButton }),
          },
          {
            render: ({ props, children }: any) => (
              <Element {...props} class="render-prop-classname" v-slots={childrenSlots(children)} />
            ),
          },
        );

      await render(<Test />);

      const component = screen.getByTestId('test-component');
      expect(component.classList.contains('conditional-component-classname')).toBe(true);
      expect(component.classList.contains('render-prop-classname')).toBe(true);
    });
  });
}
