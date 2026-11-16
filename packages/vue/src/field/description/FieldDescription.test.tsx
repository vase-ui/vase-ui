import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Field.Description />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Description />, () => ({
    refInstanceof: window.HTMLParagraphElement,
    render(node) {
      return render(<Field.Root>{node}</Field.Root>);
    },
  }));

  it('should set aria-describedby on the control automatically', async () => {
    await render(
      <Field.Root>
        <Field.Control />
        <Field.Description>Message</Field.Description>
      </Field.Root>,
    );

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('should preserve user aria-describedby values on the control', async () => {
    await render(
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description>Message</Field.Description>
      </Field.Root>,
    );

    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe(
      `external-description ${screen.getByText('Message').id}`,
    );
  });

  it('VUE-93: registers the generated id of a description with an empty id', async () => {
    await render(
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description id="">Message</Field.Description>
      </Field.Root>,
    );

    const descriptionId = screen.getByText('Message').id;
    expect(descriptionId).toMatch(/^vase-ui-/);
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      `external-description ${descriptionId}`,
    );
  });

  it('reflects the disabled state from Field.Item', async () => {
    await render(
      <Field.Root>
        <Field.Item disabled>
          <Field.Description data-testid="description">Message</Field.Description>
        </Field.Item>
      </Field.Root>,
    );

    expect(screen.getByTestId('description')).toHaveAttribute('data-disabled');
  });

  it('uses the id prop and follows a change of it, and the control names the description with it', async () => {
    const id = shallowRef('first-description');

    await render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Description id={id.value}>Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByText('Message')).toHaveAttribute('id', 'first-description');
    expect(screen.getByTestId('control')).toHaveAttribute('aria-describedby', 'first-description');

    id.value = 'second-description';
    await flushMicrotasks();

    expect(screen.getByText('Message')).toHaveAttribute('id', 'second-description');
    expect(screen.getByTestId('control')).toHaveAttribute('aria-describedby', 'second-description');
  });

  describe('KeepAlive', () => {
    it('describes the control only while KeepAlive shows the description', async () => {
      const shown = shallowRef(true);

      await render(() => (
        <Field.Root>
          <Field.Control data-testid="control" />
          <KeepAlive>
            {shown.value ? (
              <Field.Description data-testid="description">Message</Field.Description>
            ) : null}
          </KeepAlive>
        </Field.Root>
      ));

      const control = screen.getByTestId('control');
      const description = screen.getByTestId('description');
      expect(control).toHaveAttribute('aria-describedby', description.id);

      shown.value = false;
      await flushMicrotasks();

      expect(control).not.toHaveAttribute('aria-describedby');

      shown.value = true;
      await flushMicrotasks();

      expect(control).toHaveAttribute('aria-describedby', description.id);
    });

    // `KeepAlive` runs the `onActivated` hooks of one branch from its last part to its first part.
    it('keeps the order of the description and the error when KeepAlive shows the field again', async () => {
      const FieldBranch = defineComponent(() => () => (
        <Field.Root>
          <Field.Control data-testid="control" />
          <Field.Description data-testid="description">Message</Field.Description>
          <Field.Error match data-testid="error">
            Error
          </Field.Error>
        </Field.Root>
      ));
      const shown = shallowRef(true);

      await render(() => <KeepAlive>{shown.value ? <FieldBranch /> : null}</KeepAlive>);

      const control = screen.getByTestId('control');
      const ids = `${screen.getByTestId('description').id} ${screen.getByTestId('error').id}`;
      expect(control).toHaveAttribute('aria-describedby', ids);

      shown.value = false;
      await flushMicrotasks();
      shown.value = true;
      await flushMicrotasks();

      expect(control).toHaveAttribute('aria-describedby', ids);
    });

    it.each([
      {
        name: 'no description outside',
        outside: false,
        expected: ['description-a', null, null, 'description-a description-b'],
      },
      {
        name: 'a description outside',
        outside: true,
        expected: [
          'description-a description-c',
          'description-c',
          'description-c',
          'description-a description-c description-b',
        ],
      },
    ])(
      'describes the control with a description that mounts while held only after the show: $name',
      async ({ outside, expected }) => {
        const { HeldBranch, hide, mountWhileHeld, show } = createHeldBranch(
          () => (
            <Field.Description key="b" id="description-b">
              B
            </Field.Description>
          ),
          {
            renderBranch: (part) => (
              <div>
                <Field.Description key="a" id="description-a">
                  A
                </Field.Description>
                {part}
              </div>
            ),
          },
        );
        await render(() => (
          <Field.Root>
            <Field.Control data-testid="control" />
            <HeldBranch />
            {outside ? <Field.Description id="description-c">C</Field.Description> : null}
          </Field.Root>
        ));
        const control = screen.getByTestId('control');
        const seen = [control.getAttribute('aria-describedby')];
        for (const change of [hide, mountWhileHeld, show]) {
          await change();
          seen.push(control.getAttribute('aria-describedby'));
        }

        expect(seen).toEqual(expected);
      },
    );
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws a descriptive error when rendered outside <Field.Root>', async () => {
    await expect(render(<Field.Description />)).rejects.toThrow(
      'Vase UI: A part of Field must be inside <Field.Root>. Without a root the part has no field state to read. Put the part inside <Field.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
