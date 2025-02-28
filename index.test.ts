import { PromiseBatch } from "./index";
import { describe, expect, it, mock } from "bun:test";
import { setTimeout } from "node:timers/promises";


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