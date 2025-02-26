import z, { unknown } from "zod";
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Database } from 'bun:sqlite';

const userTable = sqliteTable('user', {
	id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text(),
	age: integer(),
});

const postTable = sqliteTable('post', {
	id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text(),
  title: text(),
	content: text(),
  authorUserId: text().references(() => userTable.id).notNull(),
});

const db = drizzle({ client: new Database('bun.db') });

type ObjectLike = { [key: string]: any }

type LayerSettings<TInput extends z.ZodTypeAny, TOutput extends ObjectLike> = {
  input: TInput,
  resolver: (ctx: { input: z.infer<TInput> }) => PromiseLike<TOutput>
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

class Context {
  input = {}
  settings = {
    include: {}
  }


  constructor() {
  }

  addInclude(include: any) {
    this.settings.include = {
      ...this.settings.include,
      ...include,
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

const defineLayer = <TInput extends z.ZodTypeAny, TOutput extends ObjectLike>(settings: LayerSettings<TInput, TOutput>) => {
  type Input = z.infer<typeof settings.input>
  type ResolverResult = Awaited<ReturnType<typeof settings.resolver>>
  type ResolveInput = Input | ((ctx: Context) => Input)
  type Include = IncludeRecursive<ResolverResult>
  
  const ctx = new Context() 

  const layer = {
    withInclude: (include: Include) => {
      ctx.addInclude(include)
      return layer
    },
    withInput: (resolveInput: ResolveInput, include: Include = {} as Include) => {

      ctx.addInclude(include)

      // @ts-ignore
      const resolvedInput = typeof resolveInput === 'function' ? resolveInput(ctx) : resolveInput

      const queryPromise = new LayerQueryPromise<ResolverResult>(async () => {
        const parsedInput = settings.input.parse(resolvedInput)
        const result = await settings.resolver({ input: parsedInput })
        const resultObject = await resolveWithInclude(result, ctx.settings.include)
        return resultObject
      })

      return queryPromise
    }
  }

  return layer
}

const person = defineLayer({
  input: z.object({
    id: z.string(),
  }),
  resolver: async (ctx) => {
    const personResult = await db.select().from(userTable).where(eq(userTable.id, ctx.input.id)).limit(1);
    const firstPerson = personResult.at(0)

    if (!firstPerson) {
      throw new Error('Person not found')
    }

    return {
      id: firstPerson.id,
      name: firstPerson.name,
      age: firstPerson.age,
    };
  },
});

const post = defineLayer({
  input: z.object({
    id: z.string(),
  }),
  resolver: async (ctx) => {
    const postResult = await db.select().from(postTable).where(eq(postTable.id, ctx.input.id)).limit(1);
    const firstPost = postResult.at(0)

    if (!firstPost) {
      throw new Error('Post not found')
    }
    
    return {
      ...firstPost,
      author: person.withInput({
        id: firstPost.authorUserId,
      }),
    }
  },
});

const posts = defineLayer({
  input: z.object({
    userId: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  resolver: async (ctx) => {
    console.log(ctx)

    const { userId, limit, offset } = ctx.input;
    const query = db.select({
      id: postTable.id,
      title: postTable.title,
      authorUserId: postTable.authorUserId,
    }).from(postTable).where(eq(postTable.userId, userId));
    if (limit) {
      query.limit(limit);
    }
    if (offset) {
      query.offset(offset);
    }
    const resultPosts = await query;

    return {
      count: resultPosts.length,
      items: resultPosts.map((resultPost) => {
        return {
          ...resultPost,
          details: post.withInput({
            id: resultPost.id,
          }),
        }
      }),
    };
  },
});

const result = await posts.withInput({
  userId: '1',
}, {
  items: {
    authorUserId: true,
    details: {
      content: false
    },
  }
})


console.dir(result, { depth: null })