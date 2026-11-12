import { screen } from '@testing-library/dom';
import { expect, describe, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { Component, FunctionalComponent, VNode } from 'vue';
import { cloneElement } from '../cloneElement';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { throwMissingPropError } from './utils';

type ComponentWithElement = { element: Element | null };

export function testAsProp(element: VNode, getOptions: () => VaseUiConformanceTestsOptions) {
  const { render, testRenderPropWith: Element = 'div', button = false } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  async function renderAs(target: Component) {
    let component: ComponentWithElement | null = null;

    const Test = () =>
      cloneElement(element, {
        as: target,
        ref: (value: ComponentWithElement | null) => {
          component = value;
        },
        'data-testid': 'root',
        ...(button && { nativeButton }),
      });

    await render(<Test />);
    return component as ComponentWithElement | null;
  }

  describe('prop: as', () => {
    it('renders a component with one root element and exposes that element', async () => {
      // The target exposes nothing, so the part reads its root element.
      const Target = defineComponent({ setup: () => () => <Element /> });

      const component = await renderAs(Target);

      expect(component!.element).toBe(screen.getByTestId('root'));
    });

    it('renders a functional component and exposes its element', async () => {
      const Target: FunctionalComponent = (_props, { attrs }) => <Element {...(attrs as any)} />;
      Target.inheritAttrs = false;

      const component = await renderAs(Target);

      expect(component!.element).toBe(screen.getByTestId('root'));
    });

    it('exposes no element for a component with a fragment root', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const Target = defineComponent({
        inheritAttrs: false,
        setup: () => () => [<Element key="first" />, <Element key="second" />],
      });

      const component = await renderAs(Target);

      expect(component!.element).toBe(null);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/^Vase UI:/);
    });
  });
}
