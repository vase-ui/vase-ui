import type { WritableComputedRef } from 'vue';
import { expectType } from './testUtils';
import { useControlled } from './useControlled';

function AcceptsOptionalDefault(props: { open?: boolean; defaultOpen?: boolean }) {
  const open = useControlled({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name: 'Popup',
  });

  expectType<WritableComputedRef<boolean | undefined>, typeof open>(open);
}

function AcceptsDefinedDefault(props: { open?: boolean }) {
  const open = useControlled({
    controlled: () => props.open,
    default: () => false,
    name: 'Popup',
  });

  expectType<WritableComputedRef<boolean>, typeof open>(open);
}

function AcceptsOptionalDefaultWithExplicitType(props: { open?: boolean; defaultOpen?: boolean }) {
  const open = useControlled<boolean>({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name: 'Popup',
  });

  expectType<WritableComputedRef<boolean | undefined>, typeof open>(open);
}

function AcceptsDefinedDefaultWithExplicitType(props: { open?: boolean }) {
  const open = useControlled<boolean>({
    controlled: () => props.open,
    default: () => false,
    name: 'Popup',
  });

  expectType<WritableComputedRef<boolean>, typeof open>(open);
}

void AcceptsOptionalDefault;
void AcceptsDefinedDefault;
void AcceptsOptionalDefaultWithExplicitType;
void AcceptsDefinedDefaultWithExplicitType;
