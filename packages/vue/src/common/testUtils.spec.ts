import { expectType } from './testUtils';

declare const neverValue: never;
declare const anyValue: any;
declare const unknownValue: unknown;
declare const unionValue: string | number;

expectType<never, typeof neverValue>(neverValue);
expectType<any, typeof anyValue>(anyValue);
expectType<unknown, typeof unknownValue>(unknownValue);
expectType<string | number, typeof unionValue>(unionValue);
expectType<number | string, typeof unionValue>(unionValue);

// @ts-expect-error `never` is not `string`.
expectType<string, typeof neverValue>(neverValue);
// @ts-expect-error `never` is not `any`.
expectType<any, typeof neverValue>(neverValue);
// @ts-expect-error `never` is not `unknown`.
expectType<unknown, typeof neverValue>(neverValue);
// @ts-expect-error `any` is not `never`.
expectType<never, typeof anyValue>(anyValue);
// @ts-expect-error `any` is not `string`.
expectType<string, typeof anyValue>(anyValue);
// @ts-expect-error `any` is not `unknown`.
expectType<unknown, typeof anyValue>(anyValue);
// @ts-expect-error `unknown` is not `any`.
expectType<any, typeof unknownValue>(unknownValue);
// @ts-expect-error `unknown` is not `string`.
expectType<string, typeof unknownValue>(unknownValue);
// @ts-expect-error A union is not one of its members.
expectType<string, typeof unionValue>(unionValue);
// @ts-expect-error A union is not a wider union.
expectType<string | number | boolean, typeof unionValue>(unionValue);
// @ts-expect-error A second argument does not hide a mismatch.
expectType<string, typeof unionValue>(unionValue, unionValue);
