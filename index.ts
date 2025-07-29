import z from "zod";

type ObjectLike = { [key: string]: any };

type LayerSettings<TInput extends z.ZodTypeAny, TOutput extends ObjectLike> = {
  meta?: ObjectLike;
  input: TInput;
  resolver: (
    ctx: Context<z.infer<TInput>, ObjectLike>,
  ) => PromiseLike<TOutput> | TOutput;
};

class LayerQueryPromise<T> implements Promise<T> {
  constructor(private readonly execute: () => Promise<T>) {}

  [Symbol.toStringTag] = "QueryPromise";

  catch<TResult = never>(
    onRejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<T | TResult> {
    return this.then(undefined, onRejected);
  }

  finally(onFinally?: (() => void) | null | undefined): Promise<T> {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      },
    );
  }

  then<TResult1 = T, TResult2 = never>(
    onFulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onRejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

type Context<TInput extends ObjectLike, TIncludeOptions extends ObjectLike> = {
  include: TIncludeOptions;
  input: TInput;
};

class ContextBuilder<
  TInput extends ObjectLike,
  TIncludeOptions extends ObjectLike,
> {
  include: TIncludeOptions | undefined;
  input: TInput | undefined;

  constructor() {}

  addInclude(include: TIncludeOptions | undefined) {
    this.include = include;
  }

  addInput(input: TInput) {
    this.input = input;
  }

  get(): Context<TInput, TIncludeOptions> {
    if (this.input === undefined) {
      throw new Error("Input is not set");
    }

    return {
      include: this.include as TIncludeOptions,
      input: this.input,
    };
  }
}

// const resolveWithInclude = async (
//   currentContent: any,
//   include: any,
// ): Promise<any> => {
//   const isArray = Array.isArray(currentContent);
//   const isObject =
//     typeof currentContent === "object" && currentContent !== null;
//   const isPromise = currentContent instanceof LayerQueryPromise;

//   console.log({
//     isArray,
//     isObject,
//     isPromise,
//     currentContent,
//     include,
//   });

//   if (isArray) {
//     return await Promise.all(
//       currentContent.map((item: any) => resolveWithInclude(item, include)),
//     );
//   }

//   if (isObject) {
//     const resultObject: any = {};
//     for (const key in currentContent) {
//       if (!include) {
//         continue;
//       }

//       const includeKey = include[key];
//       const content = currentContent[key];

//       const isEnabled = includeKey !== false;

//       if (!isEnabled) {
//         continue;
//       }

//       const resolvedContent = await content;
//       resultObject[key] = await resolveWithInclude(resolvedContent, includeKey);
//     }

//     return resultObject;
//   }

//   return currentContent;
// };

type ArrayIncludeOption<U> = IncludeRecursive<U> | false;
type LayerQueryIncludeOption<U> = IncludeRecursive<U>;
type ObjectIncludeOption<T> = {
  [key in keyof T]?: boolean | IncludeRecursive<T[key]>;
};
type PromiseIncludeOption<U> = IncludeRecursive<U>;
type PrimitiveIncludeOption = boolean;

type IncludeRecursive<T> =
  T extends Array<infer U>
    ? ArrayIncludeOption<U>
    : T extends LayerQueryPromise<infer U>
      ? LayerQueryIncludeOption<U>
      : T extends ObjectLike
        ? ObjectIncludeOption<T>
        : T extends PromiseLike<infer U>
          ? PromiseIncludeOption<U>
          : T extends string | number | boolean
            ? PrimitiveIncludeOption
            : never;

type PromiseSelectionRule<TInclude, TInferValue> = TInclude extends
  | true
  | ObjectLike
  ? true
  : false;

type RegularTypeSelectionRule<TInclude> = TInclude extends false ? false : true;

type ItShouldSelect<TInclude, TOutput, TInferValue = any> = TOutput extends
  | PromiseLike<TInferValue>
  | LayerQueryPromise<TInferValue>
  ? PromiseSelectionRule<TInclude, TInferValue>
  : TOutput extends string | number | boolean | ObjectLike
    ? RegularTypeSelectionRule<TInclude>
    : false;

type KeyInIncludeAsync<
  K extends keyof any,
  TOutput,
  TInclude,
> = TOutput extends PromiseLike<any> | LayerQueryPromise<any>
  ? TInclude extends true | ObjectLike
    ? K
    : never
  : TInclude extends false
    ? never
    : K;

type KeyNotInInclude<K extends keyof any, TOutput> = TOutput extends
  | PromiseLike<any>
  | LayerQueryPromise<any>
  ? never
  : K;

type KeySelector<
  K extends keyof TOutput,
  TInclude,
  TOutput,
> = K extends keyof TInclude
  ? KeyInIncludeAsync<K, TOutput[K], TInclude[K]>
  : KeyNotInInclude<K, TOutput[K]>;

type SelectedObjectResult<TInclude, TOutput extends ObjectLike> = {
  [K in keyof TOutput as KeySelector<K, TInclude, TOutput>]: TOutput[K];
};

type SelectedResult<TInclude, TOutput> = TOutput extends ObjectLike
  ? SelectedObjectResult<TInclude, TOutput>
  : ItShouldSelect<TInclude, TOutput> extends true
    ? TOutput
    : never;

export const defineLayer = <
  TInput extends z.ZodTypeAny,
  TOutput extends ObjectLike,
>(
  settings: LayerSettings<TInput, TOutput>,
) => {
  type Input = z.infer<typeof settings.input>;
  type ResolverResult = Awaited<ReturnType<typeof settings.resolver>>;
  type Include = IncludeRecursive<ResolverResult> | boolean | undefined | ObjectLike;
  
  const ctx = new ContextBuilder<Input, Include>();
  type LayerContext = Context<Input, Include>;
  type ResolveInput = Input | ((ctx: LayerContext) => Input);

  const layer = {
    resolveWithInclude: async (
      result: ObjectLike,
      includeSettings: Include,
    ): Promise<any> => {
      const includeIsTruthy = includeSettings != false;
      const includeIsTrue = includeSettings === true;
      const resultIsObject = typeof result === "object";
      const resultIsArray = Array.isArray(result);
      const resultIsPromiseLike =
        result instanceof Promise || result instanceof LayerQueryPromise;

      if (!includeIsTruthy) {
        return undefined;
      }

      if (resultIsPromiseLike) {
        if (includeIsTrue) {
          return layer.resolveWithInclude(await result, true);
        } else if (typeof includeSettings === 'object' && includeSettings !== null) {
          return layer.resolveWithInclude(await result, includeSettings);
        }
      }

      if (resultIsArray && includeIsTruthy) {
        return Promise.all(
          result.map((item) => {
            return layer.resolveWithInclude(item, includeSettings);
          }),
        );
      }

      if (resultIsObject && includeIsTruthy) {
        for (const key in result) {
          const value = result[key];
          // @ts-ignore
          const include = includeSettings?.[key];
          
          // If include is undefined for this key, include primitives but exclude promises
          if (include === undefined) {
            const isPromiseLike = value instanceof Promise || value instanceof LayerQueryPromise;
            if (isPromiseLike) {
              delete result[key]; // Exclude promises when not explicitly included
              continue;
            }
            // Keep primitives as-is
            continue;
          }
          
          const resolvedValue = await layer.resolveWithInclude(value, include);
          if (resolvedValue === undefined) {
            delete result[key];
          } else {
            result[key] = resolvedValue;
          }
        }
      }

      return result;
    },

    withInput: <TInclude extends Include>(
      resolveInput: ResolveInput,
      include?: TInclude,
    ) => {
      ctx.addInclude(include);

      const resolvedInput =
        // @ts-ignore
        typeof resolveInput === "function" ? resolveInput(ctx) : resolveInput;

      ctx.addInput(resolvedInput);

      const queryPromise = new LayerQueryPromise<ResolverResult>(async () => {
        const result = await settings.resolver(ctx.get());
        const resultObject = await layer.resolveWithInclude(
          result,
          ctx.include ?? {},
        );
        return resultObject;
      });

      return queryPromise as unknown as Promise<
        SelectedResult<TInclude, ResolverResult>
      >;
    },
  };

  return layer;
};

type Serializable =
  | string
  | number
  | { [key: string]: Serializable }
  | boolean
  | null
  | undefined
  | Serializable[];

type PromiseTrigger = () => Promise<any>;

function ControllablePromise<T>() {
  const exposed: {
    resolve: (value: T) => void;
    reject: (reason: any) => void;
  } = {
    resolve: () => {},
    reject: () => {},
  };

  const pure = new Promise<T>((resolve, reject) => {
    exposed.resolve = resolve;
    exposed.reject = reject;
  });

  // @ts-ignore
  pure.reject = exposed.reject;
  // @ts-ignore
  pure.resolve = exposed.resolve;

  return pure as unknown as Promise<T> & typeof exposed;
}

export class PromiseBatch {
  private running = 0;
  private queue: PromiseTrigger[] = [];
  private promises = new Map<string, Promise<any>>();

  constructor(private readonly concurrency: number) {}

  resolve<T>(identifier: Serializable, task: PromiseTrigger) {
    const identifierString = JSON.stringify(identifier);

    if (this.promises.has(identifierString)) {
      return this.promises.get(identifierString) as Promise<T>;
    }

    const promise = ControllablePromise<T>();
    this.promises.set(identifierString, promise);

    this.queue.push(() => {
      return task().then(promise.resolve).catch(promise.reject);
    });

    this.tick();

    return promise;
  }

  private async tick() {
    if (this.running >= this.concurrency) {
      return;
    }

    const task = this.queue.shift();
    if (!task) {
      return;
    }

    this.running++;
    await task();
    this.running--;

    if (this.queue.length > 0) {
      this.tick();
    }
  }
}
