import type { Component, ComputedRef, ShallowRef } from 'vue';
import { expectType } from '#test-utils';
import { Button } from '@vase-ui/vue/button';
import { useRender } from '@vase-ui/vue/use-render';
import type {
  ComponentRenderFn,
  HTMLProps,
  UseRenderComponentProps,
  UseRenderElementProps,
  UseRenderParameters,
  UseRenderRenderProp,
  UseRenderReturnValue,
  UseRenderState,
} from '@vase-ui/vue/use-render';
import UseRenderPart from './UseRenderPart.test.vue';
import type { UseRenderPartState } from './UseRenderPart.test.vue';

const result = useRender({});

expectType<useRender.ReturnValue<HTMLElement>, typeof result>(result);
expectType<ShallowRef<HTMLElement | null>, typeof result.element>(result.element);
expectType<() => HTMLProps, typeof result.elementProps>(result.elementProps);
expectType<ComputedRef<string | Component>, typeof result.tag>(result.tag);

const buttonResult = useRender<{}, HTMLButtonElement>({ as: 'button' });

expectType<useRender.ReturnValue<HTMLButtonElement>, typeof buttonResult>(buttonResult);
expectType<ShallowRef<HTMLButtonElement | null>, typeof buttonResult.element>(buttonResult.element);

// @ts-expect-error `enabled` is not a parameter. The template decides with `v-if`.
useRender({}, { enabled: false });

useRender({ as: 'button' }, { props: () => ({ class: 'btn-primary', onClick: () => {} }) });

interface ActiveState {
  active: boolean;
  count: number;
}

const state = null as unknown as ActiveState;

useRender(
  {},
  {
    state,
    stateAttributesMapping: {
      count: (value) => {
        expectType<number, typeof value>(value);
        return { 'data-count': value.toString() };
      },
    },
  },
);
useRender({}, { state: () => state });

useRender({}, { defaultTagName: 'span' });
useRender({}, { defaultTagName: () => undefined });
// @ts-expect-error The tag is a string.
useRender({}, { defaultTagName: 1 });

const componentProps = null as unknown as UseRenderComponentProps<ActiveState>;

useRender(componentProps, { state });

const stateType = null as unknown as useRender.State;
const renderProp = null as unknown as useRender.RenderProp<UseRenderPartState>;
const elementProps = null as unknown as useRender.ElementProps<'button'>;
const namespaceComponentProps = null as unknown as useRender.ComponentProps<ActiveState>;
const parameters = null as unknown as useRender.Parameters<ActiveState, HTMLButtonElement>;
const returnValue = null as unknown as useRender.ReturnValue<HTMLButtonElement>;

expectType<UseRenderState, typeof stateType>(stateType);
expectType<UseRenderRenderProp<UseRenderPartState>, typeof renderProp>(renderProp);
expectType<UseRenderElementProps<'button'>, typeof elementProps>(elementProps);
expectType<UseRenderComponentProps<ActiveState>, typeof namespaceComponentProps>(
  namespaceComponentProps,
);
expectType<UseRenderParameters<ActiveState, HTMLButtonElement>, typeof parameters>(parameters);
expectType<UseRenderReturnValue<HTMLButtonElement>, typeof returnValue>(returnValue);
expectType<ComponentRenderFn<HTMLProps, UseRenderPartState>, typeof renderProp>(renderProp);

<Button as={UseRenderPart} />;

<UseRenderPart
  aria-label="x"
  lang="fr"
  onClick={(event) => event.preventVaseUIHandler()}
  stateClass={(state) => {
    expectType<UseRenderPartState, typeof state>(state);
    return 'x';
  }}
/>;

const render: useRender.RenderProp<UseRenderPartState> = ({ props }) => <span {...props} />;

<UseRenderPart v-slots={{ render }} />;
