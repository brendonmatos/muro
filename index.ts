import z from 'zod'

type ObjectLike = { [key: string]: any }

type LayerSettings<TInput extends z.ZodTypeAny, TOutput extends ObjectLike> = {
  meta?: ObjectLike
  input: TInput,
  resolver: (ctx: Context<z.infer<TInput>, ObjectLike>) => PromiseLike<TOutput> | TOutput
}

class LayerQueryPromise<T> implements Promise<T> {
  constructor(private readonly execute: () => Promise<T>) {}

  [Symbol.toStringTag] = 'QueryPromise';

	catch<TResult = never>(
		onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined,
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
		onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
	): Promise<TResult1 | TResult2> {
		return this.execute().then(onFulfilled, onRejected);
	}
}

type Context<TInput extends ObjectLike, TIncludeOptions extends ObjectLike> = {
  include: TIncludeOptions
  input: TInput
}

class ContextBuilder<TInput extends ObjectLike, TIncludeOptions extends ObjectLike> {
  include: TIncludeOptions | undefined
  input: TInput | undefined

  constructor() {
  }

  addInclude(include: any) {
    this.include = include
  }

  addInput(input: any) {
    this.input = input
  }

  get(): Context<TInput, TOutput> {
    if (!this.include || !this.input) {
      throw new Error('Include or input is not set')
    }

    return {
      include: this.include,
      input: this.input,
    }
  }
}

const resolveWithInclude = async (currentContent: any, include: any): Promise<any> => {
  
  const isArray = Array.isArray(currentContent)
  const isObject = typeof currentContent === 'object' && currentContent !== null

  if (isArray) {
    return await Promise.all(currentContent.map((item: any) => resolveWithInclude(item, include)))
  }

  if (isObject) {
    const resultObject: any = {}  
    for (const key in currentContent) {
      if (!include) {
        continue
      }

      const includeKey = include[key]
      const includeKeyIsDisabled = includeKey === false
      const content = currentContent[key]
      const isLayerQuery = content instanceof LayerQueryPromise
      const isEnabled = (isLayerQuery && includeKey) || (!isLayerQuery && !includeKeyIsDisabled)

      if (!isEnabled) {
        continue
      }

      const resolvedContent = await content
      resultObject[key] = await resolveWithInclude(resolvedContent, includeKey)
    }

    return resultObject
  }

  return currentContent
}


type IncludeRecursive<T extends any> = 
  T extends Array<infer U> ?
    IncludeRecursive<U> | false : 
  T extends LayerQueryPromise<infer U> ?
    IncludeRecursive<U> :
  T extends ObjectLike ?
    {[key in keyof T]?: boolean | IncludeRecursive<T[key]> | undefined}: 
  T extends PromiseLike<infer U> ?
    IncludeRecursive<U> :
  T extends string ?
    boolean :
  T extends number ?
    boolean :
  T extends boolean ?
    boolean :
  never

export const defineLayer = <
  TInput extends z.ZodTypeAny, 
  TOutput extends ObjectLike
>
  (settings: LayerSettings<TInput, TOutput>) => {

  
  type Input = z.infer<typeof settings.input>

  const ctx = new ContextBuilder<Input, ResolverResult>()
  type LayerContext = Context<Input, ResolverResult>
  type ResolverResult = Awaited<ReturnType<typeof settings.resolver>>
  type ResolveInput = Input | ((ctx: LayerContext) => Input)
  type Include = IncludeRecursive<ResolverResult>
  
  
  const layer = {
    withInput: (resolveInput: ResolveInput, include = {} as Include) => { 
      // console.log(settings.meta, resolveInput, include)

      ctx.addInclude(include)

      // @ts-ignore
      const resolvedInput = typeof resolveInput === 'function' ? resolveInput(ctx) : resolveInput
      ctx.addInput(resolvedInput)
      
      const queryPromise = new LayerQueryPromise<ResolverResult>(async () => {
        console.log(ctx.get())
        const result = await settings.resolver(ctx.get())
        const resultObject = await resolveWithInclude(result, ctx.include)
        return resultObject
      })

      return queryPromise
    }
  }

  return layer
}

