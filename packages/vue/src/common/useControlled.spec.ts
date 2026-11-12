import type { ComputedRef } from 'vue';
import { expectType } from './testUtils';
import { useControlled } from './useControlled';

function AcceptsOptionalDefault(props: { open?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useControlled({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name: 'Popup',
  });

  expectType<ComputedRef<boolean | undefined>, typeof open>(open);
  expectType<(newValue: boolean | undefined) => void, typeof setOpen>(setOpen);
}

function AcceptsDefinedDefault(props: { open?: boolean }) {
  const [open, setOpen] = useControlled({
    controlled: () => props.open,
    default: () => false,
    name: 'Popup',
  });

  expectType<ComputedRef<boolean>, typeof open>(open);
  expectType<(newValue: boolean) => void, typeof setOpen>(setOpen);
}

function AcceptsOptionalDefaultWithExplicitType(props: { open?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useControlled<boolean>({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name: 'Popup',
  });

  expectType<ComputedRef<boolean | undefined>, typeof open>(open);
  expectType<(newValue: boolean | undefined) => void, typeof setOpen>(setOpen);
}

function AcceptsDefinedDefaultWithExplicitType(props: { open?: boolean }) {
  const [open, setOpen] = useControlled<boolean>({
    controlled: () => props.open,
    default: () => false,
    name: 'Popup',
  });

  expectType<ComputedRef<boolean>, typeof open>(open);
  expectType<(newValue: boolean) => void, typeof setOpen>(setOpen);
}

void AcceptsOptionalDefault;
void AcceptsDefinedDefault;
void AcceptsOptionalDefaultWithExplicitType;
void AcceptsDefinedDefaultWithExplicitType;
