import { expect, describe, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import AnimatedPanel from './AnimatedPanel.vue';
import ChildrenPart from './ChildrenPart.vue';
import GenericPart from './GenericPart.vue';
import HydrationFixture from './HydrationFixture.vue';
import PlainPart from './PlainPart.vue';

describe('fixture parts on a server', () => {
  it('has no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('renders PlainPart with its state attributes, class and style, and with no ref attribute', async () => {
    const html = await renderToString(
      <PlainPart active orientation="vertical" class="consumer" style={{ margin: '1px' }}>
        text
      </PlainPart>,
    );

    expect(html).toBe(
      '<div data-active data-orientation="vertical" class="consumer plain-part" style="color:red;margin:1px;" aria-orientation="vertical"><!--[-->text<!--]--></div>',
    );
  });

  it('renders ChildrenPart with its state attribute and its own node', async () => {
    const html = await renderToString(<ChildrenPart value={1}>text</ChildrenPart>);

    expect(html).toBe(
      '<div data-value="1"><!--[--><!--[--><!--[-->text<!--]--><!--]--><span data-children-part-node>1</span><!--]--></div>',
    );
  });

  it('renders GenericPart with its state attribute', async () => {
    const html = await renderToString(<GenericPart option="a" value="a" />);

    expect(html).toBe('<div data-selected><!--[--><!--]--></div>');
  });

  // A transition effect that ran on a server would throw here, because Node has no
  // `requestAnimationFrame`.
  it.each([
    {
      name: 'a closed panel that is not kept mounted has no element',
      props: { open: false },
      html: '<!---->',
    },
    {
      name: 'a closed panel that is kept mounted is hidden',
      props: { open: false, keepMounted: true },
      html: '<!--[--><div hidden><!--[--><!--]--></div><!--]-->',
    },
    {
      name: 'an open panel has no transition attribute',
      props: { open: true },
      html: '<!--[--><div data-open><!--[--><!--]--></div><!--]-->',
    },
    {
      name: 'an open panel with animateInitialOpen has the starting attribute',
      props: { open: true, animateInitialOpen: true },
      html: '<!--[--><div data-open data-starting-style><!--[--><!--]--></div><!--]-->',
    },
    {
      name: 'an open panel with the idle state has no transition attribute',
      props: { open: true, enableIdleState: true },
      html: '<!--[--><div data-open><!--[--><!--]--></div><!--]-->',
    },
  ])('renders AnimatedPanel: $name', async ({ props, html }) => {
    expect(await renderToString(<AnimatedPanel {...props} />)).toBe(html);
  });

  it('renders the ids of useVaseUiId', async () => {
    const html = await renderToString(<HydrationFixture />);

    const headingId = /<h2 id="(vase-ui-[^"]+)"/.exec(html)?.[1];
    const inputId = /<input id="(vase-ui-[^"]+)"/.exec(html)?.[1];
    expect(headingId).toBeDefined();
    expect(inputId).toBeDefined();
    expect(inputId).not.toBe(headingId);
    expect(html).toContain(`aria-labelledby="${headingId}"`);
    expect(html).toContain(`<label for="${inputId}">`);
  });
});
