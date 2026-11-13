import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import type { CSSProperties } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { VaseUIComponentProps } from './types';
import { useRenderElement } from './useRenderElement';

interface TestPartProps extends VaseUIComponentProps<Record<string, never>> {
  /** The style that the part gives in its own props. */
  ownStyle?: CSSProperties | undefined;
}

const TestPart = defineComponent(
  (props: TestPartProps) => {
    const { elementProps } = useRenderElement('div', props, {
      props: (attrs) => [{ style: props.ownStyle }, attrs],
    });
    return () => h('div', elementProps());
  },
  { props: ['as', 'stateClass', 'stateStyle', 'ownStyle'], inheritAttrs: false },
);

describe('useRenderElement on a server', () => {
  it.each([
    { name: 'an empty style object', props: { style: {} }, html: '<div></div>' },
    {
      name: 'a style that unsets an own property',
      props: { ownStyle: { overflow: 'scroll' }, style: { overflow: undefined } },
      html: '<div></div>',
    },
    {
      name: 'a style with an empty value',
      props: { style: { overflow: '' } },
      html: '<div></div>',
    },
    { name: 'an own style that is undefined', props: { ownStyle: undefined }, html: '<div></div>' },
    { name: 'a style that is undefined', props: { style: undefined }, html: '<div></div>' },
    { name: 'a style that is an empty string', props: { style: '' }, html: '<div></div>' },
    {
      name: 'a state style that is an empty object',
      props: { stateStyle: () => ({}) },
      html: '<div></div>',
    },
    {
      name: 'a style with one value',
      props: { style: { margin: '1px' } },
      html: '<div style="margin:1px;"></div>',
    },
  ])('renders the element with $name', async ({ props, html }) => {
    expect(await renderToString(h(TestPart, props))).toBe(html);
  });
});
