import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import GenericPart from './GenericPart.vue';
import PlainPart from './PlainPart.vue';
import type { PlainPartState } from './PlainPart.vue';

export const nativeAttributes = (
  <PlainPart
    onClick={(event) => event.preventVaseUIHandler()}
    lang="fr"
    aria-label="x"
    data-testid="b"
  />
);

export const propsOfPart = (
  <PlainPart as="a" active onKeydown={(event) => event.key} class="c" style={{ color: 'red' }} />
);

const render: ComponentRenderFn<HTMLProps, PlainPartState> = ({ props }) => <span {...props} />;

export const renderSlot = <PlainPart v-slots={{ render }} />;

export const renderSlotWithRef = (
  <PlainPart
    v-slots={{
      render: ({ props }: { props: HTMLProps }) => (
        <span {...props} ref={(element) => props.ref(element as Element | null)} />
      ),
    }}
  />
);

export const genericPart = (
  <GenericPart
    option={1}
    value={2}
    onValueChange={(value, details) => [value satisfies number, details.reason]}
  />
);

// @ts-expect-error `active` is a boolean
export const wrongPropType = <PlainPart active="yes" />;

// @ts-expect-error an unknown prop
export const unknownProp = <PlainPart notAProp={1} />;

// @ts-expect-error a click handler gets a MouseEvent, not a string
export const wrongHandlerParameter = <PlainPart onClick={(event: string) => event} />;

// @ts-expect-error `value` has the type of `option`
export const wrongValueType = <GenericPart option={1} value="two" />;

// @ts-expect-error the first argument of the listener is a number
export const wrongListener = <GenericPart option={1} onValueChange={(value: string) => value} />;
