// index.ts
class LayerQueryPromise {
  execute;
  constructor(execute) {
    this.execute = execute;
  }
  [Symbol.toStringTag] = "QueryPromise";
  catch(onRejected) {
    return this.then(undefined, onRejected);
  }
  finally(onFinally) {
    return this.then((value) => {
      onFinally?.();
      return value;
    }, (reason) => {
      onFinally?.();
      throw reason;
    });
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

class ContextBuilder {
  include;
  input;
  constructor() {}
  addInclude(include) {
    this.include = include;
  }
  addInput(input) {
    this.input = input;
  }
  get() {
    if (this.input === undefined) {
      throw new Error("Input is not set");
    }
    return {
      include: this.include,
      input: this.input
    };
  }
}
var defineLayer = (settings) => {
  const ctx = new ContextBuilder;
  const layer = {
    resolveWithInclude: async (result, includeSettings) => {
      const includeIsTruthy = includeSettings != false;
      const includeIsTrue = includeSettings === true;
      const resultIsObject = typeof result === "object";
      const resultIsArray = Array.isArray(result);
      const resultIsPromiseLike = result instanceof Promise || result instanceof LayerQueryPromise;
      if (!includeIsTruthy) {
        return;
      }
      if (resultIsPromiseLike) {
        if (includeIsTrue) {
          return layer.resolveWithInclude(await result, true);
        } else if (typeof includeSettings === "object" && includeSettings !== null) {
          return layer.resolveWithInclude(await result, includeSettings);
        }
      }
      if (resultIsArray && includeIsTruthy) {
        const tasks = result.map((item) => {
          return () => layer.resolveWithInclude(item, includeSettings);
        });
        if (settings.resolvePromises) {
          return settings.resolvePromises(tasks);
        }
        return Promise.all(tasks.map((t) => t()));
      }
      if (resultIsObject && includeIsTruthy) {
        for (const key in result) {
          const value = result[key];
          const include = includeSettings?.[key];
          if (include === undefined) {
            const isPromiseLike = value instanceof Promise || value instanceof LayerQueryPromise;
            if (isPromiseLike) {
              delete result[key];
              continue;
            }
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
    withInput: (resolveInput, include) => {
      ctx.addInclude(include);
      const resolvedInput = typeof resolveInput === "function" ? resolveInput(ctx) : resolveInput;
      ctx.addInput(resolvedInput);
      const queryPromise = new LayerQueryPromise(async () => {
        const result = await settings.resolver(ctx.get());
        const resultObject = await layer.resolveWithInclude(result, ctx.include ?? {});
        return resultObject;
      });
      return queryPromise;
    }
  };
  return layer;
};
function ControllablePromise() {
  const exposed = {
    resolve: () => {},
    reject: () => {}
  };
  const pure = new Promise((resolve, reject) => {
    exposed.resolve = resolve;
    exposed.reject = reject;
  });
  pure.reject = exposed.reject;
  pure.resolve = exposed.resolve;
  return pure;
}

class PromiseBatch {
  concurrency;
  running = 0;
  queue = [];
  promises = new Map;
  constructor(concurrency) {
    this.concurrency = concurrency;
  }
  resolve(identifier, task) {
    const identifierString = JSON.stringify(identifier);
    if (this.promises.has(identifierString)) {
      return this.promises.get(identifierString);
    }
    const promise = ControllablePromise();
    this.promises.set(identifierString, promise);
    this.queue.push(() => {
      return task().then(promise.resolve).catch(promise.reject);
    });
    this.tick();
    return promise;
  }
  async tick() {
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
var createPoolResolver = (limit) => {
  const batch = new PromiseBatch(limit);
  return async (tasks) => {
    return Promise.all(tasks.map((task, index) => batch.resolve(index, task)));
  };
};
export {
  defineLayer,
  createPoolResolver,
  PromiseBatch
};
