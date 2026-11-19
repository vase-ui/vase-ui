import { expectType } from '#test-utils';
import { Form, type FormValues } from '@vase-ui/vue/form';

interface Values {
  name: string;
  age: number;
}

export const typed = (
  <Form<Values>
    onSubmit={(event, values) => {
      expectType<SubmitEvent, typeof event>(event);
      expectType<string, typeof values.name>(values.name);
      expectType<number, typeof values.age>(values.age);
      // @ts-expect-error The values have `name` and `age`, not `email`.
      values.email.startsWith('a');
    }}
  />
);

export const untyped = (
  <Form
    onSubmit={(_event, values) => {
      expectType<any, typeof values>(values);
    }}
  />
);

export const valuesType = <Form onSubmit={(_event: SubmitEvent, values: FormValues) => values} />;
