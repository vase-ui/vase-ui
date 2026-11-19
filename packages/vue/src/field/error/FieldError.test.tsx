import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref, shallowRef } from 'vue';
import type { Component } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  nextAnimationsRead,
  nextEndingStyle,
  nextEvent,
  POPUP_EXIT_CSS,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitSingleFrame,
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

  it('VUE-118: gives the control the id that the #render slot gives the error while it shows', async () => {
    const shown = shallowRef(true);

    await render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Error
          match={shown.value}
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <div {...props} id="own-error">
                {h(children)}
              </div>
            ),
          }}
        />
      </Field.Root>
    ));

    const control = screen.getByRole('textbox');
    expect(control).toHaveAttribute('aria-describedby', 'own-error');

    shown.value = false;
    await flushMicrotasks();

    expect(control).not.toHaveAttribute('aria-describedby');
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

    it('VUE-118: removes the id of the #render slot from the control when the exit starts', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const shown = shallowRef(true);

      await render(() => (
        <div>
          <style>{POPUP_EXIT_CSS}</style>
          <Field.Root>
            <Field.Control />
            <Field.Error
              class="popup"
              match={shown.value}
              v-slots={{
                render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                  <div {...props} id="own-error">
                    {h(children)}
                  </div>
                ),
              }}
            />
          </Field.Root>
        </div>
      ));

      const control = screen.getByRole('textbox');
      expect(control).toHaveAttribute('aria-describedby', 'own-error');

      await nextEndingStyle(document.getElementById('own-error')!, {
        action: () => {
          shown.value = false;
        },
      });

      expect(control).not.toHaveAttribute('aria-describedby');
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const onTransitionEnd = vi.fn();
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
                onTransitionend={onTransitionEnd}
              >
                Message
              </Field.Error>
            </Field.Root>
          </div>
        );
      });

      const { container, user } = await render(<Test />);
      expect(screen.queryByTestId('error')).toBe(null);

      // The error mounts with the click, so the wait is on its container.
      const end = await nextEvent(container, 'transitionend', {
        after: 'transitionrun',
        action: () => user.click(screen.getByText('Show')),
      });

      expect(onTransitionEnd).toHaveBeenCalledExactlyOnceWith(end);
      expect(end.target).toBe(screen.getByTestId('error'));
    });

    it('shows the last field message when the default slot leaves during the exit', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const errors = shallowRef<Record<string, string>>({ email: 'Check the address' });
      const custom = shallowRef(true);
      await render(() => (
        <div>
          <style>{POPUP_EXIT_CSS}</style>
          <Form errors={errors.value}>
            <Field.Root name="email">
              <Field.Control />
              <Field.Error
                class="popup"
                v-slots={custom.value ? { default: () => 'Custom text' } : {}}
              />
            </Field.Root>
          </Form>
        </div>
      ));
      const error = screen.getByText('Custom text');
      await nextEndingStyle(error, {
        action: () => {
          errors.value = {};
          custom.value = false;
        },
      });
      expect(error.textContent).toBe('Check the address');
    });

    it('keeps the last list during exit when its messages are cleared in place', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const errors = ref({ email: ['First', 'Second'] });
      await render(() => (
        <div>
          <style>{POPUP_EXIT_CSS}</style>
          <Form errors={errors.value}>
            <Field.Root name="email">
              <Field.Control />
              <Field.Error class="popup" data-testid="error" />
            </Field.Root>
          </Form>
        </div>
      ));
      const error = screen.getByTestId('error');
      const messages = () =>
        within(error)
          .queryAllByRole('listitem')
          .map((item) => item.textContent);
      errors.value.email[0] = 'Updated';
      await flushMicrotasks();
      expect(messages()).toEqual(['Updated', 'Second']);

      await nextEndingStyle(error, {
        action: () => {
          errors.value.email.length = 0;
        },
      });
      expect(messages()).toEqual(['Updated', 'Second']);
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

      await render(
        <div>
          <style>{style}</style>
          <Field.Root
            validationMode="onChange"
            validate={(value) => (value === 'bad' ? 'Bad value' : null)}
          >
            <Field.Control />
            <Field.Error class="animation-test-error" data-testid="error" />
          </Field.Root>
        </div>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      await fireEvent.input(input, { target: { value: 'bad' } });
      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('Bad value');
      // The error mounts when the field becomes invalid, and it reads its animations in the frame
      // after the mount. The wait for the read of the exit must start after that read.
      await waitSingleFrame();

      // After a stall, one frame can start and end the exit, and the part then removes the error.
      // Chromium then sends no `animationstart` to it, so the case reads the text when the part
      // reads its animations.
      const animations = await nextAnimationsRead(error, {
        action: () => fireEvent.input(input, { target: { value: 'good' } }),
      });
      expect(animations).toHaveLength(1);
      expect(error.textContent).toBe('Bad value');

      await Promise.all(animations.map((animation) => animation.finished));
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
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
      const error = screen.getByTestId('error');
      expect(error).not.toBe(null);

      const read = nextAnimationsRead(error);

      // `user.click` can yield a frame, which is long enough for the 1ms animation to finish.
      await fireEvent.click(screen.getByText('Hide'));

      expect(error).toHaveAttribute('data-ending-style');

      const animations = await read;
      await Promise.all(animations.map((animation) => animation.finished));
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('KeepAlive', () => {
    it('does not describe the control with an error that renders while KeepAlive holds it', async () => {
      let root = null as InstanceType<typeof Field.Root> | null;
      // The error mounts with no element, because the field is valid then.
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <Field.Error key="error" data-testid="error">
          Error
        </Field.Error>
      ));
      await render(() => (
        <Field.Root
          ref={(instance) => {
            root = instance as InstanceType<typeof Field.Root> | null;
          }}
          validate={() => 'Error'}
        >
          <Field.Control data-testid="control" />
          <HeldBranch />
        </Field.Root>
      ));
      const control = screen.getByTestId('control');

      await mountWhileHeld();
      await root?.validate();
      await flushMicrotasks();

      expect(control).not.toHaveAttribute('aria-describedby');

      await show();

      expect(control).toHaveAttribute('aria-describedby', screen.getByTestId('error').id);
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
  // instance set, and a later case of the file can then get a warning about a slot.
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
