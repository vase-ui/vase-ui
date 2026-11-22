import type { InjectionKey } from 'vue';

/** What a `CSPProvider` gives to the parts in it. The properties are reactive. */
export interface CSPForPart {
  readonly nonce: string | undefined;
  readonly disableStyleElements: boolean;
}

export const cspKey: InjectionKey<CSPForPart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'csp' : undefined,
);
