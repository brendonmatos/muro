import { PromiseBatch, defineLayer, createPoolResolver } from "./index";
import { describe, expect, it, mock } from "bun:test";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";


class Parallel {
  max = 0
  #current = 0

  increase(a: number) {
    this.current += a
  }
  decrease(a: number) {
    this.current -= a
  }
  get current() {
    return this.#current
  }
  set current(a: number) {
    this.#current = a
    if (this.#current > this.max) {
      this.max = this.#current
    }
  }
}


it("should accept multiple requests in parallel but with a concurrency limit", async () => {
  const batch = new PromiseBatch(2)

  const parallel = new Parallel()

  const fn = mock(() => {
    parallel.increase(1)
    return new Promise(async (resolve) => {
      await setTimeout(1000)
      resolve('Hello')
      parallel.decrease(1)
    })
  })

  await Promise.all([
    batch.resolve('1', fn),
    batch.resolve('2', fn),
    batch.resolve('3', fn),
    batch.resolve('4', fn),
    batch.resolve('5', fn),
  ])


  expect(parallel.max).toBe(2)
  
})

it("should dedup requests", async () => {
  const batch = new PromiseBatch(1)

  const fn = mock(() => {
    return new Promise(async (resolve) => {
      await setTimeout(1000)
      resolve('Hello')
    })
  })

  const promises = Promise.all([
    batch.resolve('1', fn),
    batch.resolve('1', fn),
    batch.resolve('1', fn),
    batch.resolve('1', fn),
    batch.resolve('1', fn),
  ])

  expect(await promises).toEqual(['Hello', 'Hello', 'Hello', 'Hello', 'Hello'])
  expect(fn).toHaveBeenCalledTimes(1)
})

it("should reject if the promise is rejected", async () => {
  const batch = new PromiseBatch(1)

  const fn = mock(() => {
    return new Promise(async (resolve, reject) => {
      await setTimeout(1000)
      reject(new Error('Hello'))
    })
  })

  await expect(batch.resolve('1', fn)).rejects.toThrow('Hello')
  expect(fn).toHaveBeenCalledTimes(1)
})

it("should resolve promises using a configurable pool", async () => {
  const parallel = new Parallel()

  const item = defineLayer({
    input: z.object({ id: z.number() }),
    resolver: async () => {
      parallel.increase(1)
      await setTimeout(100)
      parallel.decrease(1)
      return 'ok'
    },
  })

  const list = defineLayer({
    input: z.object({ count: z.number() }),
    resolver: async (ctx) => ({
      items: Array.from({ length: ctx.input.count }, (_, i) =>
        item.withInput({ id: i }),
      ),
    }),
    resolvePromises: createPoolResolver(4),
  })

  await list.withInput({ count: 10 }, { items: true } as any)
  expect(parallel.max).toBe(4)
})

describe("defineLayer include system", () => {
  const person = defineLayer({
    input: z.object({
      id: z.string(),
    }),
    resolver: async (ctx) => {
      return {
        name: "John Doe",
        age: 20,
        email: "john@example.com",
      };
    },
  });

  const book = defineLayer({
    input: z.object({
      id: z.string(),
    }),
    resolver: async (ctx) => {
      return {
        title: "The Great Gatsby",
        pages: 180,
        author: person.withInput({ id: "1" }),
      };
    },
  });

  it("should exclude promises when no include is specified", async () => {
    const result = await book.withInput({ id: "1" });
    
    expect(result).toEqual({
      title: "The Great Gatsby",
      pages: 180,
    } as any);
    expect(result as any).not.toHaveProperty("author");
  });

  it("should include all fields when promise field is included with true", async () => {
    const result = await book.withInput({ id: "1" }, {
      title: true,
      pages: true,
      author: true,
    } as any);
    
    expect(result).toEqual({
      title: "The Great Gatsby",
      pages: 180,
      author: {
        name: "John Doe",
        age: 20,
        email: "john@example.com",
      },
    } as any);
  });

  it("should selectively include/exclude fields with object include", async () => {
    const result = await book.withInput({ id: "1" }, {
      title: true,
      pages: false,
      author: {
        name: true,
        age: false,
      },
    } as any);
    
    expect(result).toEqual({
      title: "The Great Gatsby",
      author: {
        name: "John Doe",
        email: "john@example.com",
      },
    } as any);
    expect(result.author as any).not.toHaveProperty("age");
    expect(result as any).not.toHaveProperty("pages");
  });

  it("should exclude fields marked as false", async () => {
    const result = await book.withInput({ id: "1" }, {
      title: true,
      pages: false,
      author: true,
    } as any);
    
    expect(result).toEqual({
      title: "The Great Gatsby",
      author: {
        name: "John Doe",
        age: 20,
        email: "john@example.com",
      },
    } as any);
    expect(result as any).not.toHaveProperty("pages");
  });

  it("should completely exclude promise fields when marked as false", async () => {
    const result = await book.withInput({ id: "1" }, {
      title: true,
      pages: true,
      author: false,
    } as any);
    
    expect(result).toEqual({
      title: "The Great Gatsby",
      pages: 180,
    } as any);
    expect(result as any).not.toHaveProperty("author");
  });
});