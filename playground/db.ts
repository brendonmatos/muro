import { defineLayer } from "../index";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Database } from "bun:sqlite";
import { z } from "zod";

type ObjectLike = Record<string, any>;

const optionalBasedOnInclude = <T extends ObjectLike>(
  include: any,
  object: T,
) => {
  return Object.fromEntries(
    Object.entries(object).filter(([key, value]) => include[key] !== false),
  ) as Partial<T>;
};

export const userTable = sqliteTable("user", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text(),
  age: integer(),
});

export const postTable = sqliteTable("post", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text(),
  title: text(),
  content: text(),
  authorUserId: text()
    .references(() => userTable.id)
    .notNull(),
});

const db = drizzle({ client: new Database("bun.db") });

const author = defineLayer({
  meta: {
    name: "author",
  },
  input: z.object({
    id: z.string(),
  }),
  resolver: async (ctx) => {
    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, ctx.input.id))
      .limit(1);
    const firstUser = users.at(0);

    if (!firstUser) {
      throw new Error("Person not found");
    }

    return {
      id: firstUser.id,
      name: firstUser.name,
      age: firstUser.age,
      posts: posts.withInput({
        userId: firstUser.id,
      }),
    };
  },
});

const post = defineLayer({
  meta: {
    name: "post",
  },
  input: z.object({
    id: z.string(),
  }),
  resolver: async (ctx) => {
    const postResult = await db
      .select(
        optionalBasedOnInclude(ctx.include, {
          id: postTable.id,
          title: postTable.title,
          authorUserId: postTable.authorUserId,
          content: postTable.content,
        }),
      )
      .from(postTable)
      .where(eq(postTable.id, ctx.input.id))
      .limit(1);

    const firstPost = postResult.at(0);

    if (!firstPost) {
      throw new Error("Post not found");
    }

    return {
      ...firstPost,
      author:
        firstPost.authorUserId &&
        author.withInput({ id: firstPost.authorUserId }),
    };
  },
});

const posts = defineLayer({
  meta: {
    name: "posts",
  },
  input: z.object({
    userId: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  resolver: async (ctx) => {
    const { userId, limit, offset } = ctx.input;
    const query = db
      .select(
        optionalBasedOnInclude(ctx.include, {
          id: postTable.id,
          title: postTable.title,
          authorUserId: postTable.authorUserId,
        }),
      )
      .from(postTable)
      .where(eq(postTable.userId, userId));
    if (limit) query.limit(limit);
    if (offset) query.offset(offset);
    const resultPosts = await query;

    return {
      count: resultPosts.length,
      items: resultPosts,
    };
  },
});

const result = await post.withInput(
  {
    id: "1",
  },
);

console.dir(result, { depth: null });
