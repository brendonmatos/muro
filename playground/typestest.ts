type IncludeRecursive<T extends { [key: string]: any }> = {[key in keyof T]?: boolean | IncludeRecursive<T[key]> | undefined}


type Settings<TInput extends {}, TOutput extends { [key: string]: any }> = {
  input: TInput
  resolver: (ctx: { input: TInput }) => PromiseLike<TOutput>
  output: IncludeRecursive<TOutput>
}

const defineSettings = <TInput extends {}, TOutput extends { [key: string]: any }>(settings: Settings<TInput, TOutput>) => {
  return settings
}



const settings = defineSettings({
  input: { id: '1' },
  resolver: async (ctx) => {
    return { 
      person: {
        name: 'John'
      }
    }
  },
  output: {
    person: {
      name: false
    }
  }
})

