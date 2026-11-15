import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, defineComponent, shallowRef, Teleport } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { recordVueWarnings } from '../../test/reportedMessages';
import { isInTreeOf, useKeepAliveState } from './useKeepAliveState';

describe('useKeepAliveState', () => {
  const { render } = createRenderer();

  const Part = defineComponent(
    (props: { owner: () => Element | null }) => {
      const element = shallowRef<HTMLElement | null>(null);
      const { isHeld } = useKeepAliveState(element, (target) => isInTreeOf(props.owner(), target));

      return () => <span ref={element} data-testid="part" data-held={String(isHeld.value)} />;
    },
    { props: ['owner'] },
  );

  const Owner = defineComponent(
    (props: { partContainer?: HTMLElement | undefined }) => {
      const owner = shallowRef<HTMLElement | null>(null);

      return () => (
        <div ref={owner}>
          {props.partContainer ? (
            <Teleport to={props.partContainer}>
              <Part owner={() => owner.value} />
            </Teleport>
          ) : (
            <Part owner={() => owner.value} />
          )}
        </div>
      );
    },
    { props: ['partContainer'] },
  );

  it('does not hold a part of an app that mounts in a detached element', async () => {
    const container = document.createElement('div');
    const app = createApp({ render: () => <Owner /> });
    recordVueWarnings(app);
    app.mount(container);
    onTestFinished(() => app.unmount());
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="part"]')).toHaveAttribute('data-held', 'false');
  });

  it('does not hold a part that a Teleport moves out of the shadow root of its owner', async () => {
    const host = document.createElement('div');
    const ownerContainer = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(ownerContainer);
    document.body.append(host);
    onTestFinished(() => host.remove());

    await render(
      <Teleport to={ownerContainer}>
        <Owner partContainer={document.body} />
      </Teleport>,
    );

    expect(screen.getByTestId('part')).toHaveAttribute('data-held', 'false');
  });
});
