import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import { createHeldBranch, createRenderer, screen } from '#test-utils';
import { useInputRegistration } from './useInputRegistration';

const RegisteredControl = defineComponent(
  (props: { register: (input: HTMLInputElement) => (() => void) | void }, { expose }) => {
    const input = shallowRef<HTMLInputElement | null>(null);
    const { updateInputRegistration } = useInputRegistration(input, (element) =>
      props.register(element),
    );
    expose({ updateInputRegistration });
    return () => (
      <input
        data-testid="input"
        ref={(value) => {
          input.value = value as HTMLInputElement | null;
        }}
      />
    );
  },
  { props: ['register'] },
);

describe('useInputRegistration', () => {
  const { render } = createRenderer();

  it.each([
    { name: 'mounted in a held branch', inActivation: false },
    { name: 'mounted in the flush of the show', inActivation: true },
  ])('registers no input while KeepAlive holds the part: $name', async ({ inActivation }) => {
    const release = vi.fn();
    const register = vi.fn(() => release);
    const { HeldBranch, hide, mountWhileHeld, show, mountInActivation } = createHeldBranch(() => (
      <RegisteredControl register={register} />
    ));
    await render(() => <HeldBranch />);

    if (inActivation) {
      await hide();
      await mountInActivation();
    } else {
      await mountWhileHeld();
      expect(register).not.toHaveBeenCalled();
      await show();
    }

    expect(register).toHaveBeenCalledExactlyOnceWith(screen.getByTestId('input'));
    expect(release).not.toHaveBeenCalled();
  });

  it('releases the input at the hold and registers it again at the show', async () => {
    const release = vi.fn();
    const register = vi.fn(() => release);
    const { HeldBranch, hide, show } = createHeldBranch(
      () => <RegisteredControl register={register} />,
      { mounted: true },
    );
    await render(() => <HeldBranch />);
    const input = screen.getByTestId('input');

    expect(register).toHaveBeenCalledExactlyOnceWith(input);
    expect(release).not.toHaveBeenCalled();

    await hide();

    expect(release).toHaveBeenCalledTimes(1);

    await show();

    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenLastCalledWith(input);
  });

  it('registers the input again when the part updates the registration', async () => {
    const release = vi.fn();
    const register = vi.fn(() => release);
    const control = shallowRef<{ updateInputRegistration: () => void } | null>(null);
    const { HeldBranch, hide, show } = createHeldBranch(
      () => <RegisteredControl ref={control} register={register} />,
      { mounted: true },
    );
    await render(() => <HeldBranch />);
    const input = screen.getByTestId('input');

    control.value?.updateInputRegistration();

    expect(release).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenLastCalledWith(input);

    await hide();
    control.value?.updateInputRegistration();

    expect(release).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledTimes(2);

    await show();

    expect(release).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledTimes(3);
  });

  it('releases the input when the part unmounts', async () => {
    const release = vi.fn();
    const register = vi.fn(() => release);
    const mounted = shallowRef(true);
    await render(() => (
      <div>{mounted.value ? <RegisteredControl register={register} /> : null}</div>
    ));

    mounted.value = false;
    await nextTick();

    expect(register).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
