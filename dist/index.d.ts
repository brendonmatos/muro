import z from "zod";
type ObjectLike = {
    [key: string]: any;
};
export type PromiseResolver = <T>(tasks: Array<() => Promise<T>>) => Promise<T[]>;
type LayerSettings<TInput extends z.ZodTypeAny, TOutput extends ObjectLike> = {
    meta?: ObjectLike;
    input: TInput;
    resolver: (ctx: Context<z.infer<TInput>, ObjectLike>) => PromiseLike<TOutput> | TOutput;
    resolvePromises?: PromiseResolver;
};
declare class LayerQueryPromise<T> implements Promise<T> {
    private readonly execute;
    constructor(execute: () => Promise<T>);
    [Symbol.toStringTag]: string;
    catch<TResult = never>(onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): Promise<T | TResult>;
    finally(onFinally?: (() => void) | null | undefined): Promise<T>;
    then<TResult1 = T, TResult2 = never>(onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
}
type Context<TInput extends ObjectLike, TIncludeOptions> = {
    include: TIncludeOptions;
    input: TInput;
};
type ArrayIncludeOption<U> = IncludeRecursive<U> | false;
type LayerQueryIncludeOption<U> = IncludeRecursive<U>;
type ObjectIncludeOption<T> = {
    [key in keyof T]?: boolean | IncludeRecursive<T[key]>;
};
type PromiseIncludeOption<U> = IncludeRecursive<U>;
type PrimitiveIncludeOption = boolean;
type IncludeRecursive<T> = T extends Array<infer U> ? ArrayIncludeOption<U> : T extends LayerQueryPromise<infer U> ? LayerQueryIncludeOption<U> : T extends ObjectLike ? ObjectIncludeOption<T> : T extends PromiseLike<infer U> ? PromiseIncludeOption<U> : T extends string | number | boolean ? PrimitiveIncludeOption : never;
type PromiseSelectionRule<TInclude, TInferValue> = TInclude extends true | ObjectLike ? true : false;
type RegularTypeSelectionRule<TInclude> = TInclude extends false ? false : true;
type ItShouldSelect<TInclude, TOutput, TInferValue = any> = TOutput extends PromiseLike<TInferValue> | LayerQueryPromise<TInferValue> ? PromiseSelectionRule<TInclude, TInferValue> : TOutput extends string | number | boolean | ObjectLike ? RegularTypeSelectionRule<TInclude> : false;
type KeyInIncludeAsync<K extends keyof any, TOutput, TInclude> = TOutput extends PromiseLike<any> | LayerQueryPromise<any> ? TInclude extends true | ObjectLike ? K : never : TInclude extends false ? never : K;
type KeyNotInInclude<K extends keyof any, TOutput> = TOutput extends PromiseLike<any> | LayerQueryPromise<any> ? never : K;
type KeySelector<K extends keyof TOutput, TInclude, TOutput> = K extends keyof TInclude ? KeyInIncludeAsync<K, TOutput[K], TInclude[K]> : KeyNotInInclude<K, TOutput[K]>;
type SelectedObjectResult<TInclude, TOutput extends ObjectLike> = {
    [K in keyof TOutput as KeySelector<K, TInclude, TOutput>]: TOutput[K];
};
type SelectedResult<TInclude, TOutput> = TOutput extends ObjectLike ? SelectedObjectResult<TInclude, TOutput> : ItShouldSelect<TInclude, TOutput> extends true ? TOutput : never;
export declare const defineLayer: <TInput extends z.ZodTypeAny, TOutput extends ObjectLike>(settings: LayerSettings<TInput, TOutput>) => {
    resolveWithInclude: (result: ObjectLike, includeSettings: boolean | ObjectLike | IncludeRecursive<Awaited<TOutput>> | IncludeRecursive<Awaited<TOutput>> | undefined) => Promise<any>;
    withInput: <TInclude extends boolean | ObjectLike | IncludeRecursive<Awaited<TOutput>> | IncludeRecursive<Awaited<TOutput>> | undefined>(resolveInput: z.core.output<TInput> | ((ctx: Context<z.core.output<TInput>, boolean | ObjectLike | IncludeRecursive<Awaited<TOutput>> | IncludeRecursive<Awaited<TOutput>> | undefined>) => z.core.output<TInput>), include?: TInclude) => Promise<SelectedResult<TInclude, Awaited<TOutput> | Awaited<TOutput>>>;
};
type Serializable = string | number | {
    [key: string]: Serializable;
} | boolean | null | undefined | Serializable[];
type PromiseTrigger = () => Promise<any>;
export declare class PromiseBatch {
    private readonly concurrency;
    private running;
    private queue;
    private promises;
    constructor(concurrency: number);
    resolve<T>(identifier: Serializable, task: PromiseTrigger): Promise<T>;
    private tick;
}
export declare const createPoolResolver: (limit: number) => PromiseResolver;
export {};
