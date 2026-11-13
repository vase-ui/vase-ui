import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { Component } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import FieldErrorHydration from './FieldErrorHydration.test.vue';

describe('<Field.Error />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Error match />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Field.Root invalid>{node}</Field.Root>);
    },
  }));

  it('should set aria-describedby on the control automatically', async () => {
    await render(
      <Field.Root invalid>
        <Field.Control />
        <Field.Error match>Message</Field.Error>
      </Field.Root>,
    );

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('uses the id prop as the id of the message and in aria-describedby of the control', async () => {
    await render(
      <Field.Root invalid>
        <Field.Control />
        <Field.Error match id="own-error">
          Message
        </Field.Error>
      </Field.Root>,
    );

    expect(screen.getByText('Message')).toHaveAttribute('id', 'own-error');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'own-error');
  });

  it.each([
    { name: 'one text', error: 'Username is reserved', items: [] },
    {
      name: 'a list of texts',
      error: ['First error', 'Second error'],
      items: ['First error', 'Second error'],
    },
  ])('renders $name in the children component of the #render slot', async ({ error, items }) => {
    await render(
      <Form errors={{ username: error }}>
        <Field.Root name="username">
          <Field.Control />
          <Field.Error
            data-testid="error"
            v-slots={{
              render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                <strong {...props}>{h(children)}</strong>
              ),
            }}
          />
        </Field.Root>
      </Form>,
    );

    const element = screen.getByTestId('error');
    expect(element.localName).toBe('strong');
    expect(Array.from(element.querySelectorAll('li'), (item) => item.textContent)).toEqual(items);
    expect(element.textContent).toBe(items.length > 0 ? items.join('') : String(error));
  });

  it('names the message in aria-describedby of the control only while it shows', async () => {
    await render(
      <Form>
        <Field.Root>
          <Field.Control required />
          <Field.Error match="valueMissing">Required</Field.Error>
        </Field.Root>
        <button type="submit">submit</button>
      </Form>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    expect(input).not.toHaveAttribute('aria-describedby');

    await fireEvent.click(screen.getByText('submit'));
    expect(input).toHaveAttribute('aria-describedby', screen.getByText('Required').id);

    await fireEvent.input(input, { target: { value: 'a' } });
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('should show error messages by default', async () => {
    await render(
      <Form>
        <Field.Root>
          <Field.Control required />
          <Field.Error>Message</Field.Error>
        </Field.Root>
        <button type="submit">submit</button>
      </Form>,
    );

    expect(screen.queryByText('Message')).toBe(null);

    const input = screen.getByRole<HTMLInputElement>('textbox');

    await fireEvent.focusIn(input);
    await fireEvent.input(input, { target: { value: 'a' } });
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.focusOut(input);
    expect(screen.queryByText('Message')).toBe(null);

    await fireEvent.click(screen.getByText('submit'));
    expect(screen.queryByText('Message')).not.toBe(null);
  });

  describe('prop: match', () => {
    it('should only render when `match` matches constraint validation', async () => {
      await render(
        <Form>
          <Field.Root>
            <Field.Control required minlength={2} />
            <Field.Error match="valueMissing">Message</Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      expect(screen.queryByText('Message')).toBe(null);

      await fireEvent.click(screen.getByText('submit'));
      expect(screen.queryByText('Message')).not.toBe(null);

      const input = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: 'a' } });
      expect(screen.queryByText('Message')).toBe(null);

      await fireEvent.input(input, { target: { value: '' } });
      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('should show custom errors', async () => {
      await render(
        <Form>
          <Field.Root validate={() => 'error'}>
            <Field.Control />
            <Field.Error match="customError">Message</Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: 'a' } });
      await fireEvent.focusOut(input);
      expect(screen.queryByText('Message')).toBe(null);

      await fireEvent.click(screen.getByText('submit'));
      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('uses `match={false}` as the default slot for Form errors', async () => {
      await render(
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" required minlength={8} pattern="[a-z]+" />
            <Field.Error match="valueMissing">Username is required.</Field.Error>
            <Field.Error match="tooShort">Username must be at least 8 characters.</Field.Error>
            <Field.Error match="patternMismatch">
              Username can only include lowercase letters.
            </Field.Error>
            <Field.Error data-testid="default-error" match={false} />
          </Field.Root>
        </Form>,
      );

      expect(screen.queryByText('Username is required.')).toBe(null);
      expect(screen.queryByText('Username must be at least 8 characters.')).toBe(null);
      expect(screen.queryByText('Username can only include lowercase letters.')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('uses an omitted `match` as the default slot for Form errors', async () => {
      await render(
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" required minlength={8} pattern="[a-z]+" />
            <Field.Error match="valueMissing">Username is required.</Field.Error>
            <Field.Error match="tooShort">Username must be at least 8 characters.</Field.Error>
            <Field.Error match="patternMismatch">
              Username can only include lowercase letters.
            </Field.Error>
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.queryByText('Username is required.')).toBe(null);
      expect(screen.queryByText('Username must be at least 8 characters.')).toBe(null);
      expect(screen.queryByText('Username can only include lowercase letters.')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('uses the Field.Control name fallback for Form errors', async () => {
      await render(
        <Form errors={{ email: 'Email is already taken' }}>
          <Field.Root>
            <Field.Control name="email" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      const control = screen.getByRole('textbox');

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Email is already taken');

      await fireEvent.input(control, { target: { value: 'next@example.com' } });

      expect(control).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);
    });

    it('ignores inherited Form error properties', async () => {
      await render(
        <Form errors={{}}>
          <Field.Root name="constructor">
            <Field.Control />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);
    });

    it('renders Form error arrays as a list', async () => {
      await render(
        <Form errors={{ username: ['Username is reserved', 'Username is too short'] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      const list = screen.getByTestId('default-error').querySelector('ul');
      expect(list).not.toBe(null);
      expect(list?.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getByText('Username is reserved')).not.toBe(null);
      expect(screen.getByText('Username is too short')).not.toBe(null);
    });

    it('renders single-item Form error arrays as text', async () => {
      await render(
        <Form errors={{ username: ['Username is reserved'] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('default-error').querySelector('ul')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('renders client validation error arrays as a list', async () => {
      await render(
        <Form>
          <Field.Root validate={() => ['First error', 'Second error']}>
            <Field.Control />
            <Field.Error data-testid="default-error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('submit'));

      const list = screen.getByTestId('default-error').querySelector('ul');
      expect(list).not.toBe(null);
      expect(list?.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getByText('First error')).not.toBe(null);
      expect(screen.getByText('Second error')).not.toBe(null);
    });

    it('does not register an empty error id', async () => {
      await render(
        <Field.Root invalid>
          <Field.Control aria-describedby="external-description" />
          <Field.Error id="">Message</Field.Error>
        </Field.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-describedby',
        'external-description',
      );
    });

    it('ignores empty Form error arrays', async () => {
      await render(
        <Form errors={{ username: [] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.queryByTestId('default-error')).toBe(null);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    });

    it('uses `match={false}` as the default slot for client validation errors', async () => {
      await render(
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Error data-testid="default-error" match={false} />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('default-error')).toBe(null);

      await fireEvent.click(screen.getByText('submit'));

      expect(screen.getByTestId('default-error')).not.toBe(null);
    });

    it('uses the client validation path for specific matches when Form errors are present', async () => {
      await render(
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username" validate={() => 'Client validation error'}>
            <Field.Control />
            <Field.Error data-testid="custom-error" match="customError" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('submit'));

      expect(screen.getByTestId('custom-error')).toHaveTextContent('Client validation error');
      expect(screen.getByTestId('custom-error')).not.toHaveTextContent('Username is reserved');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('always renders the error message when `match` is true', async () => {
      await render(
        <Field.Root>
          <Field.Control required />
          <Field.Error match>Message</Field.Error>
        </Field.Root>,
      );

      expect(screen.queryByText('Message')).not.toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      function notifyTransitionFinished() {
        transitionFinished = true;
      }

      const style = `
        .animation-test-error {
          transition: opacity 1ms;
        }

        .animation-test-error[data-starting-style],
        .animation-test-error[data-ending-style] {
          opacity: 0;
        }
      `;

      const Test = defineComponent(() => {
        const showError = shallowRef(false);

        return () => (
          <div>
            <style>{style}</style>
            <button
              type="button"
              onClick={() => {
                showError.value = true;
              }}
            >
              Show
            </button>
            <Field.Root>
              <Field.Control required />
              <Field.Error
                class="animation-test-error"
                data-testid="error"
                match={showError.value}
                onTransitionend={notifyTransitionFinished}
              >
                Message
              </Field.Error>
            </Field.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Show'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('error')).not.toBe(null);
    });

    it('keeps its message while it animates out', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-error[data-ending-style] {
          animation: test-anim 100ms;
        }
      `;
      const textsAtStart: string[] = [];

      await render(
        <div>
          <style>{style}</style>
          <Field.Root
            validationMode="onChange"
            validate={(value) => (value === 'bad' ? 'Bad value' : null)}
          >
            <Field.Control />
            <Field.Error
              class="animation-test-error"
              data-testid="error"
              onAnimationstart={(event: Event) => {
                textsAtStart.push((event.currentTarget as HTMLElement).textContent ?? '');
              }}
            />
          </Field.Root>
        </div>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      await fireEvent.input(input, { target: { value: 'bad' } });
      expect(screen.getByTestId('error')).toHaveTextContent('Bad value');

      await fireEvent.input(input, { target: { value: 'good' } });

      await waitFor(() => {
        expect(screen.queryByTestId('error')).toBe(null);
      });
      expect(textsAtStart).toEqual(['Bad value']);
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-error[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      const Test = defineComponent(() => {
        const showError = shallowRef(true);

        return () => (
          <div>
            <style>{style}</style>
            <button
              type="button"
              onClick={() => {
                showError.value = false;
              }}
            >
              Hide
            </button>
            <Field.Root>
              <Field.Control required />
              <Field.Error class="animation-test-error" data-testid="error" match={showError.value}>
                Message
              </Field.Error>
            </Field.Root>
          </div>
        );
      });

      await render(<Test />);
      expect(screen.getByTestId('error')).not.toBe(null);

      // `user.click` can yield a frame, which is long enough for the 1ms animation to finish.
      await fireEvent.click(screen.getByText('Hide'));

      expect(screen.getByTestId('error')).toHaveAttribute('data-ending-style');

      await waitFor(() => {
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'one text', errors: { name: 'Server error' }, items: [] },
      {
        name: 'a list of texts',
        errors: { name: ['First error', 'Second error'] },
        items: ['First error', 'Second error'],
      },
      { name: 'no error', errors: {}, items: [] },
    ])('hydrates the error of a form: $name', async ({ errors, items }) => {
      const props = { errors };
      const serverHtml = await renderOnServer(
        'src/field/error/FieldErrorHydration.test.vue',
        props,
      );

      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverError = template.content.querySelector('[data-testid="error"]');
      const serverAlways = template.content.querySelector('[data-testid="always"]');
      const serverControl = template.content.querySelector('[data-testid="control"]');
      expect(serverAlways?.textContent).toBe('Always');
      expect(serverControl?.getAttribute('aria-describedby')).toBe(
        [serverError?.id, serverAlways?.id].filter(Boolean).join(' '),
      );
      expect(
        Array.from(serverError?.querySelectorAll('li') ?? [], (item) => item.textContent),
      ).toEqual(items);

      const { container } = await hydrate(FieldErrorHydration, { serverHtml, props });

      expect(within(container).queryByTestId('error') === null).toBe(serverError === null);
      expect(within(container).getByTestId('always')).toHaveTextContent('Always');
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case that renders a slot gets a warning about that slot.
  it('throws a descriptive error when rendered outside <Field.Root>', async () => {
    await expect(render(<Field.Error match />)).rejects.toThrow(
      'Vase UI: A part of Field must be inside <Field.Root>. Without a root the part has no field state to read. Put the part inside <Field.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
