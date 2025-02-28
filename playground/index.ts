import { defineLayer } from "../index";
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Database } from 'bun:sqlite';
import { z } from "zod";

const optionalBasedOnInclude = <T extends ObjectLike>(include: any, object: T) => {
  return Object.fromEntries(
    Object
      .entries(object)
      .filter(([key, value]) => include[key] !== false)
  ) as Partial<T>
}

export const userTable = sqliteTable('user', {
	id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text(),
	age: integer(),
});

export const postTable = sqliteTable('post', {
	id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text(),
  title: text(),
	content: text(),
  authorUserId: text().references(() => userTable.id).notNull(),
});

const db = drizzle({ client: new Database('bun.db') });

const person = defineLayer({
  meta: {
    name: 'person',
  },
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
  meta: {
    name: 'post',
  },
  input: z.object({
    id: z.string(),
  }),
  resolver: async (ctx) => {
    const postResult = await db.select(optionalBasedOnInclude(ctx.include, {
      id: postTable.id,
      title: postTable.title,
      authorUserId: postTable.authorUserId,
      content: postTable.content,
    })).from(postTable).where(eq(postTable.id, ctx.input.id)).limit(1);
    const firstPost = postResult.at(0)

    if (!firstPost) {
      throw new Error('Post not found')
    }
    
    return {
      ...firstPost,
      author: firstPost.authorUserId ? person.withInput({
        id: firstPost.authorUserId,
      }) : null,
    }
  },
});

const posts = defineLayer({
  meta: {
    name: 'posts',
  },
  input: z.object({
    userId: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  resolver: async (ctx) => {
    const { userId, limit, offset } = ctx.input;
    const query = db.select(optionalBasedOnInclude(ctx.include, {
      id: postTable.id,
      title: postTable.title,
      authorUserId: postTable.authorUserId,
    })).from(postTable).where(eq(postTable.userId, userId));
    if (limit) {
      query.limit(limit);
    }
    if (offset) {
      query.offset(offset);
    }
    const resultPosts = await query

    return {
      count: resultPosts.length,
      items: resultPosts.map((resultPost) => {
        return {
          ...resultPost,
          details: resultPost.id ? post.withInput({
            id: resultPost.id,
          }) : null,
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
    details: true
  }
})

console.dir(result, { depth: null })