import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, hydrate, renderOnServer, screen } from '#test-utils';
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableMessage from '../../../test/fixtures/LabelableMessage.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';
import LabelableHydration from './LabelableHydration.test.vue';
import LabelableLabelPosition from './LabelableLabelPosition.test.vue';
import LabelableMessagePosition from './LabelableMessagePosition.test.vue';

describe('labelable provider', () => {
  const { render } = createRenderer();

  describe('control id', () => {
    const OneControl = defineComponent(
      (props: { controlId?: string | undefined }) => () => (
        <LabelableScope>
          <LabelableLabel data-testid="label">Label</LabelableLabel>
          <LabelableControl id={props.controlId} data-testid="control" />
        </LabelableScope>
      ),
      { props: ['controlId'] },
    );

    it('gives a label and a control with no id the same generated id', async () => {
      await render(<OneControl />);

      const control = screen.getByTestId('control');
      expect(control.id).not.toBe('');
      expect(screen.getByTestId('label')).toHaveAttribute('for', control.id);
    });

    it('gives the id of the control to the label', async () => {
      await render(<OneControl controlId="control-a" />);

      expect(screen.getByTestId('control')).toHaveAttribute('id', 'control-a');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'control-a');
    });

    it('follows a change of the id of the control', async () => {
      const { rerender } = await render(<OneControl controlId="control-a" />);

      await rerender(<OneControl controlId="control-b" />);

      expect(screen.getByTestId('control')).toHaveAttribute('id', 'control-b');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'control-b');
    });

    it('gives the control a new generated id when its id is removed', async () => {
      const { rerender } = await render(<OneControl controlId="control-a" />);

      await rerender(<OneControl />);

      const control = screen.getByTestId('control');
      expect(control.id).not.toBe('');
      expect(control.id).not.toBe('control-a');
      expect(screen.getByTestId('label')).toHaveAttribute('for', control.id);
    });

    describe('two controls', () => {
      const TwoControls = defineComponent(
        (props: { first: boolean; second: boolean; firstEnabled?: boolean | undefined }) => () => (
          <LabelableScope>
            {props.first && <LabelableControl id="a" enabled={props.firstEnabled} />}
            {props.second && <LabelableControl id="b" />}
            <LabelableLabel data-testid="label">Label</LabelableLabel>
          </LabelableScope>
        ),
        { props: ['first', 'second', 'firstEnabled'] },
      );

      it('keeps the selected id when the other control goes away', async () => {
        const { rerender } = await render(<TwoControls first second />);
        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

        await rerender(<TwoControls first second={false} />);

        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');
      });

      it('keeps the selected id when the last control goes away', async () => {
        const { rerender } = await render(<TwoControls first second={false} />);
        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

        await rerender(<TwoControls first={false} second={false} />);

        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');
      });

      it('selects the other control when the selected control goes away', async () => {
        const { rerender } = await render(<TwoControls first second />);
        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

        await rerender(<TwoControls first={false} second />);

        expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
      });

      it('selects the other control when the selected control gets `enabled` false', async () => {
        const { rerender } = await render(<TwoControls first second />);
        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

        await rerender(<TwoControls first second firstEnabled={false} />);

        expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
      });

      it('keeps the control selected when its id changes beside another control', async () => {
        const ChangedId = defineComponent(
          (props: { firstId: string }) => () => (
            <LabelableScope>
              <LabelableControl id={props.firstId} />
              <LabelableControl id="b" />
              <LabelableLabel data-testid="label">Label</LabelableLabel>
            </LabelableScope>
          ),
          { props: ['firstId'] },
        );
        const { rerender } = await render(<ChangedId firstId="a" />);
        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

        await rerender(<ChangedId firstId="c" />);

        expect(screen.getByTestId('label')).toHaveAttribute('for', 'c');
      });

      it('keeps the selected id when a control with no id is mounted beside it', async () => {
        await render(
          <LabelableScope>
            <LabelableControl id="a" />
            <LabelableControl />
            <LabelableLabel data-testid="label">Label</LabelableLabel>
          </LabelableScope>,
        );

        expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');
      });
    });

    describe('a control that replaces another control', () => {
      const SwappedControl = defineComponent(
        (props: { swapped: boolean; firstId: string | null }) => () => (
          <LabelableScope>
            <LabelableLabel data-testid="label">Label</LabelableLabel>
            {props.swapped ? (
              <LabelableControl key="second" data-testid="control" />
            ) : (
              <LabelableControl key="first" id={props.firstId} data-testid="control" />
            )}
          </LabelableScope>
        ),
        { props: ['swapped', 'firstId'] },
      );

      it('drops the old id when a control with no id replaces a control with an id', async () => {
        const { rerender } = await render(<SwappedControl swapped={false} firstId="control" />);
        expect(screen.getByTestId('label')).toHaveAttribute('for', 'control');

        await rerender(<SwappedControl swapped firstId="control" />);

        const control = screen.getByTestId('control');
        expect(control.id).not.toBe('control');
        expect(screen.getByTestId('label')).toHaveAttribute('for', control.id);
      });

      it('removes `for` for a control that registers `null`, and restores it for a control with no id', async () => {
        const { rerender } = await render(<SwappedControl swapped={false} firstId={null} />);
        expect(screen.getByTestId('label')).not.toHaveAttribute('for');

        await rerender(<SwappedControl swapped firstId={null} />);

        expect(screen.getByTestId('label')).toHaveAttribute(
          'for',
          screen.getByTestId('control').id,
        );
      });
    });

    it('does not register a control with `enabled` false, and the control has its own id', async () => {
      await render(
        <LabelableScope>
          <LabelableLabel data-testid="label">Label</LabelableLabel>
          <LabelableControl id="own" enabled={false} data-testid="control" />
        </LabelableScope>,
      );

      expect(screen.getByTestId('control')).toHaveAttribute('id', 'own');
      const labelFor = screen.getByTestId('label').getAttribute('for');
      expect(labelFor).toBeTruthy();
      expect(labelFor).not.toBe('own');
    });
  });

  describe('label id', () => {
    const LabelAndControl = defineComponent(
      (props: { showLabel: boolean; labelId?: string | undefined }) => () => (
        <LabelableScope>
          {props.showLabel && (
            <LabelableLabel id={props.labelId} data-testid="label">
              Label
            </LabelableLabel>
          )}
          <LabelableControl data-testid="control" />
        </LabelableScope>
      ),
      { props: ['showLabel', 'labelId'] },
    );

    it.each([
      { name: 'a generated id', labelId: undefined },
      { name: 'the `id` prop of the label', labelId: 'own-label' },
    ])('names the control with $name', async ({ labelId }) => {
      await render(<LabelAndControl showLabel labelId={labelId} />);

      const label = screen.getByTestId('label');
      expect(label.id).not.toBe('');
      expect(label.id).toBe(labelId ?? label.id);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', label.id);
    });

    it('follows a change of the id of the label', async () => {
      const { rerender } = await render(<LabelAndControl showLabel labelId="label-a" />);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'label-a');

      await rerender(<LabelAndControl showLabel labelId="label-b" />);

      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'label-b');
    });

    it('removes the name of the control when the label goes away', async () => {
      const { rerender } = await render(<LabelAndControl showLabel />);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby');

      await rerender(<LabelAndControl showLabel={false} />);

      expect(screen.getByTestId('control')).not.toHaveAttribute('aria-labelledby');
    });

    it('names the control with the last label that is left', async () => {
      const TwoLabels = defineComponent(
        (props: { second: boolean }) => () => (
          <LabelableScope>
            <LabelableLabel id="first-label" />
            {props.second && <LabelableLabel id="second-label" />}
            <LabelableControl data-testid="control" />
          </LabelableScope>
        ),
        { props: ['second'] },
      );
      const { rerender } = await render(<TwoLabels second />);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'second-label');

      await rerender(<TwoLabels second={false} />);

      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'first-label');
    });

    // The compiled template of the fixture mounts the new label before it unmounts the old label.
    // A render function in TSX reuses the label component, so it does not show this order.
    it('keeps the name of the control when a label before it replaces a label after it', async () => {
      const tree = (labelBeforeControl: boolean) => (
        <LabelableScope>
          <LabelableLabelPosition labelBeforeControl={labelBeforeControl} />
        </LabelableScope>
      );
      const { rerender } = await render(tree(false));
      const control = screen.getByTestId('control');
      expect(control).toHaveAttribute('aria-labelledby', screen.getByTestId('label').id);

      await rerender(tree(true));

      expect(control).toHaveAttribute('aria-labelledby', screen.getByTestId('label').id);
    });
  });

  describe('message ids', () => {
    const DescribedControl = defineComponent(
      (props: { messageIds: string[]; describedBy?: string | undefined }) => () => (
        <LabelableScope>
          {props.messageIds.map((id, index) => (
            <LabelableMessage key={index} id={id} />
          ))}
          <LabelableControl aria-describedby={props.describedBy} data-testid="control" />
        </LabelableScope>
      ),
      { props: ['messageIds', 'describedBy'] },
    );

    it('puts the ids of the messages in `aria-describedby` in the order of the parts, after the ids of the consumer, with no duplicate', async () => {
      await render(
        <DescribedControl messageIds={['message-b', 'message-a']} describedBy="given message-b" />,
      );

      expect(screen.getByTestId('control')).toHaveAttribute(
        'aria-describedby',
        'given message-b message-a',
      );
    });

    it('removes the id of a message that goes away', async () => {
      const { rerender } = await render(<DescribedControl messageIds={['message-a']} />);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-describedby', 'message-a');

      await rerender(<DescribedControl messageIds={[]} />);

      expect(screen.getByTestId('control')).not.toHaveAttribute('aria-describedby');
    });

    it('replaces the id of a message when the id changes', async () => {
      const { rerender } = await render(<DescribedControl messageIds={['message-a']} />);

      await rerender(<DescribedControl messageIds={['message-b']} />);

      expect(screen.getByTestId('control')).toHaveAttribute('aria-describedby', 'message-b');
    });

    it('registers nothing for a message with an empty id', async () => {
      await render(<DescribedControl messageIds={['', 'message-a']} />);

      expect(screen.getByTestId('control')).toHaveAttribute('aria-describedby', 'message-a');
    });

    // The compiled template of the fixture mounts a message that comes before the control, and then
    // unmounts a message that comes after it. A render function in TSX reuses the message
    // component, so it does not show this order.
    it('keeps the description of the control when a message replaces a message with the same id', async () => {
      const tree = (messageBeforeControl: boolean) => (
        <LabelableScope>
          <LabelableMessagePosition messageBeforeControl={messageBeforeControl} />
        </LabelableScope>
      );
      const { rerender } = await render(tree(false));
      const control = screen.getByTestId('control');
      expect(control).toHaveAttribute('aria-describedby', 'error');

      await rerender(tree(true));
      expect(control).toHaveAttribute('aria-describedby', 'error');

      await rerender(tree(false));
      expect(control).toHaveAttribute('aria-describedby', 'error');
    });

    it('puts the message ids of the outer provider first', async () => {
      await render(
        <LabelableScope>
          <LabelableScope>
            <LabelableMessage id="inner-message" />
            <LabelableControl data-testid="control" />
          </LabelableScope>
          <LabelableMessage id="outer-message" />
        </LabelableScope>,
      );

      expect(screen.getByTestId('control')).toHaveAttribute(
        'aria-describedby',
        'outer-message inner-message',
      );
    });
  });

  describe('under `KeepAlive`', () => {
    // Each part has its own key, so `KeepAlive` keeps both parts and deactivates the one that the
    // other part replaces.
    const ControlInKeepAlive = defineComponent(
      (props: {
        swapped: boolean;
        firstId?: string | null | undefined;
        secondId?: string | undefined;
      }) =>
        () => (
          <LabelableScope>
            <LabelableLabel data-testid="label">Label</LabelableLabel>
            <KeepAlive>
              {props.swapped ? (
                <LabelableControl key="second" id={props.secondId} data-testid="control" />
              ) : (
                <LabelableControl key="first" id={props.firstId} data-testid="control" />
              )}
            </KeepAlive>
          </LabelableScope>
        ),
      { props: ['swapped', 'firstId', 'secondId'] },
    );

    it('gives the label the id of the control that is shown', async () => {
      const ids = { firstId: 'a', secondId: 'b' };
      const { rerender } = await render(<ControlInKeepAlive swapped={false} {...ids} />);
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      await rerender(<ControlInKeepAlive swapped {...ids} />);

      expect(screen.getByTestId('control')).toHaveAttribute('id', 'b');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');

      await rerender(<ControlInKeepAlive swapped={false} {...ids} />);

      expect(screen.getByTestId('control')).toHaveAttribute('id', 'a');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');
    });

    it('restores `for` when a control with no id replaces a control that registers `null`', async () => {
      const { rerender } = await render(<ControlInKeepAlive swapped={false} firstId={null} />);
      expect(screen.getByTestId('label')).not.toHaveAttribute('for');

      await rerender(<ControlInKeepAlive swapped firstId={null} />);

      expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByTestId('control').id);
    });

    it('ignores a change of the id of a deactivated control until `KeepAlive` activates the control', async () => {
      const firstId = shallowRef('a');
      const First = defineComponent(() => () => <LabelableControl id={firstId.value} />);
      const Shown = defineComponent(
        (props: { shown: boolean }) => () => (
          <LabelableScope>
            <LabelableLabel data-testid="label">Label</LabelableLabel>
            <KeepAlive>{props.shown ? <First /> : null}</KeepAlive>
          </LabelableScope>
        ),
        { props: ['shown'] },
      );
      const { rerender } = await render(<Shown shown />);
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      await rerender(<Shown shown={false} />);

      firstId.value = 'c';
      await flushMicrotasks();

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      await rerender(<Shown shown />);

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'c');
    });

    it('names the control with the label that is shown', async () => {
      const LabelInKeepAlive = defineComponent(
        (props: { swapped: boolean }) => () => (
          <LabelableScope>
            <KeepAlive>
              {props.swapped ? (
                <LabelableLabel key="second" id="label-b" />
              ) : (
                <LabelableLabel key="first" id="label-a" />
              )}
            </KeepAlive>
            <LabelableControl data-testid="control" />
          </LabelableScope>
        ),
        { props: ['swapped'] },
      );
      const { rerender } = await render(<LabelInKeepAlive swapped={false} />);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'label-a');

      await rerender(<LabelInKeepAlive swapped />);

      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'label-b');

      await rerender(<LabelInKeepAlive swapped={false} />);

      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', 'label-a');
    });

    it('removes the id of a deactivated message and ignores a change of that id until `KeepAlive` activates the message', async () => {
      const messageId = shallowRef('error-a');
      const Message = defineComponent(() => () => <LabelableMessage id={messageId.value} />);
      const Shown = defineComponent(
        (props: { shown: boolean }) => () => (
          <LabelableScope>
            <KeepAlive>{props.shown ? <Message /> : null}</KeepAlive>
            <LabelableControl data-testid="control" />
          </LabelableScope>
        ),
        { props: ['shown'] },
      );
      const { rerender } = await render(<Shown shown />);
      expect(screen.getByTestId('control')).toHaveAttribute('aria-describedby', 'error-a');

      await rerender(<Shown shown={false} />);

      expect(screen.getByTestId('control')).not.toHaveAttribute('aria-describedby');

      messageId.value = 'error-b';
      await flushMicrotasks();

      expect(screen.getByTestId('control')).not.toHaveAttribute('aria-describedby');

      await rerender(<Shown shown />);

      expect(screen.getByTestId('control')).toHaveAttribute('aria-describedby', 'error-b');
    });
  });

  describe('with no provider', () => {
    it.each([
      { name: 'an `id` prop', id: 'own' },
      { name: 'no `id` prop', id: undefined },
    ])(
      'gives a control with $name an id, no `aria-labelledby` and no `aria-describedby`',
      async ({ id }) => {
        await render(<LabelableControl id={id} data-testid="control" />);

        const control = screen.getByTestId('control');
        expect(control.id).not.toBe('');
        expect(control.id).toBe(id ?? control.id);
        expect(control).not.toHaveAttribute('aria-labelledby');
        expect(control).not.toHaveAttribute('aria-describedby');
      },
    );

    it('gives a label a generated id and no `for`', async () => {
      await render(<LabelableLabel data-testid="label">Label</LabelableLabel>);

      const label = screen.getByTestId('label');
      expect(label.id).not.toBe('');
      expect(label).not.toHaveAttribute('for');
    });
  });

  describe('server HTML and hydration', () => {
    const FILE = 'src/internals/labelable-provider/LabelableHydration.test.vue';

    // A `<template>` element parses the HTML with no side effect.
    function parse(html: string) {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    }

    function read(root: ParentNode) {
      const label = root.querySelector('[data-testid="label"]');
      const message = root.querySelector('[data-testid="message"]');
      const control = root.querySelector('[data-testid="control"]');
      return {
        labelId: label?.id,
        labelFor: label?.getAttribute('for'),
        messageId: message?.id,
        controlId: control?.id,
        labelledBy: control?.getAttribute('aria-labelledby'),
        describedBy: control?.getAttribute('aria-describedby'),
        ids: Array.from(root.querySelectorAll('[id]'), (element) => element.id),
      };
    }

    it('links a label, a message and a control that comes last', async () => {
      const props = { order: 'label-message-control' } as const;
      const serverHtml = await renderOnServer(FILE, props);

      const server = read(parse(serverHtml));
      expect(server.controlId).toBeTruthy();
      expect(server.labelFor).toBe(server.controlId);
      expect(server.labelledBy).toBe(server.labelId);
      expect(server.describedBy).toBe(server.messageId);

      const { container } = await hydrate(LabelableHydration, { serverHtml, props });

      expect(read(container)).toEqual(server);
    });

    it('links a control that comes first to its label, and to its message after the page hydrates', async () => {
      const props = { order: 'control-label-message' } as const;
      const serverHtml = await renderOnServer(FILE, props);

      const server = read(parse(serverHtml));
      expect(server.controlId).toBeTruthy();
      expect(server.labelFor).toBe(server.controlId);
      expect(server.labelledBy).toBe(server.labelId);
      expect(server.describedBy).toBeNull();

      const { container } = await hydrate(LabelableHydration, { serverHtml, props });

      expect(read(container)).toEqual({ ...server, describedBy: server.messageId });
    });

    it('points `aria-labelledby` of a control with no label at no element until the page hydrates', async () => {
      const props = { order: 'control-only' } as const;
      const serverHtml = await renderOnServer(FILE, props);

      const server = read(parse(serverHtml));
      expect(server.labelledBy).toBeTruthy();
      expect(server.ids).not.toContain(server.labelledBy);

      const { container } = await hydrate(LabelableHydration, { serverHtml, props });

      expect(read(container).labelledBy).toBeNull();
    });

    it('gives the control its `id` prop after the page hydrates, and the label follows', async () => {
      const props = { order: 'label-message-control', controlId: 'email' } as const;
      const serverHtml = await renderOnServer(FILE, props);

      const server = read(parse(serverHtml));
      expect(server.controlId).toBeTruthy();
      expect(server.controlId).not.toBe('email');
      expect(server.labelFor).toBe(server.controlId);

      const { container } = await hydrate(LabelableHydration, { serverHtml, props });

      const hydrated = read(container);
      expect(hydrated.controlId).toBe('email');
      expect(hydrated.labelFor).toBe('email');
    });

    it('names a control with the `id` prop of a label that comes after it once the page hydrates', async () => {
      const props = { order: 'control-label-message', labelId: 'own-label' } as const;
      const serverHtml = await renderOnServer(FILE, props);

      const server = read(parse(serverHtml));
      expect(server.labelId).toBe('own-label');
      expect(server.labelledBy).toBeTruthy();
      expect(server.labelledBy).not.toBe('own-label');

      const { container } = await hydrate(LabelableHydration, { serverHtml, props });

      expect(read(container).labelledBy).toBe('own-label');
    });
  });
});
