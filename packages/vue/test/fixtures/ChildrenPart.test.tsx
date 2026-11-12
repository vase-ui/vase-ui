import { expect, describe, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance } from '#test-utils';
import type { HTMLProps } from '../../src/internals/types';
import ChildrenPart from './ChildrenPart.vue';

describe('<ChildrenPart />', () => {
  const { render } = createRenderer();

  describeConformance(<ChildrenPart />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
    childrenSelector: '[data-children-part-node]',
  }));

  it('renders the content, then the node of the part, as children of the element', async () => {
    const { container } = await render(<ChildrenPart value={1}>Content</ChildrenPart>);

    const element = container.firstElementChild as HTMLElement;
    expect(element.textContent).toBe('Content1');
    expect(element.children).toHaveLength(1);
    expect(element.children[0]).toHaveAttribute('data-children-part-node');
  });

  it('shows a state change of the part in its node under the #render slot', async () => {
    const { container, setProps } = await render(
      <ChildrenPart
        value={1}
        v-slots={{
          render: ({ props, children }: { props: HTMLProps; children: Component }) => (
            <section {...props}>{h(children, null, () => 'Content')}</section>
          ),
        }}
      />,
    );

    const node = container.querySelector('[data-children-part-node]') as HTMLElement;
    expect(node).toHaveTextContent('1');

    await setProps({ value: 2 });

    expect(node).toHaveTextContent('2');
  });
});
