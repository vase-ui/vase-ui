import { describe, expect, it, onTestFinished } from 'vitest';
import { createSSRApp, h, nextTick } from 'vue';
import { renderOnServer, setAttributeInHtml, takeReportedMessages } from '#test-utils';
import UseRenderPart from './UseRenderPart.test.vue';

describe('useRender: hydration', () => {
  it('renders a component of a consumer one time when a value differs from the server HTML', async () => {
    const props = { 'aria-label': 'Name' };
    const serverHtml = setAttributeInHtml(
      await renderOnServer('src/use-render/UseRenderPart.test.vue', props),
      'div',
      'aria-label',
      'server',
    );
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = serverHtml;
    let renders = 0;
    // The component calls `stateClass` one time in each render.
    const stateClass = () => {
      renders += 1;
      return undefined;
    };
    const app = createSSRApp({ render: () => h(UseRenderPart, { ...props, stateClass }) });
    onTestFinished(() => {
      app.unmount();
      container.remove();
    });

    app.mount(container);
    await nextTick();
    await nextTick();

    expect(renders).toBe(1);
    expect(takeReportedMessages()).toEqual([]);
  });
});
