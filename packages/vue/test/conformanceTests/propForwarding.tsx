import { screen } from '@testing-library/dom';
import { expect, describe, it } from 'vitest';
import type { VNode } from 'vue';
import { cloneElement } from '../cloneElement';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { randomStringValue } from '../randomStringValue';
import { throwMissingPropError } from './utils';

export function testPropForwarding(
  element: VNode,
  getOptions: () => VaseUiConformanceTestsOptions,
) {
  const { render, testRenderPropWith: Element = 'div', button = false } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  describe('prop forwarding', () => {
    it('forwards custom props to the default element', async () => {
      const otherProps = {
        lang: 'fr',
        'data-foobar': randomStringValue(),
      };

      await render(cloneElement(element, { 'data-testid': 'root', ...otherProps }));

      const customRoot = screen.getByTestId('root');
      expect(customRoot).toHaveAttribute('lang', otherProps.lang);
      expect(customRoot).toHaveAttribute('data-foobar', otherProps['data-foobar']);
    });

    it('forwards custom props to the customized element defined with a function', async () => {
      const otherProps = {
        lang: 'fr',
        'data-foobar': randomStringValue(),
        ...(button && { nativeButton }),
      };

      await render(
        cloneElement(element, otherProps, {
          render: ({ props }: any) => <Element {...props} data-testid="custom-root" />,
        }),
      );

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('lang', otherProps.lang);
      expect(customRoot).toHaveAttribute('data-foobar', otherProps['data-foobar']);
    });

    it('forwards custom props to the customized element defined using JSX', async () => {
      const otherProps = {
        lang: 'fr',
        'data-foobar': randomStringValue(),
        ...(button && { nativeButton }),
      };

      await render(
        cloneElement(element, {
          as: Element,
          'data-testid': 'custom-root',
          ...otherProps,
        }),
      );

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('lang', otherProps.lang);
      expect(customRoot).toHaveAttribute('data-foobar', otherProps['data-foobar']);
    });

    it('forwards the custom `style` attribute defined on the component', async () => {
      await render(
        cloneElement(element, {
          style: { color: 'green' },
          'data-testid': 'custom-root',
        }),
      );

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('style');
      expect(customRoot.getAttribute('style')).toContain('color: green');
    });

    it('forwards the custom `style` attribute defined on the render element', async () => {
      await render(
        cloneElement(
          element,
          { ...(button && { nativeButton }) },
          {
            render: ({ props }: any) => (
              <Element {...props} style={{ color: 'green' }} data-testid="custom-root" />
            ),
          },
        ),
      );

      const customRoot = screen.getByTestId('custom-root');
      expect(customRoot).toHaveAttribute('style');
      expect(customRoot.getAttribute('style')).toContain('color: green');
    });
  });
}
