import { defineLayer } from "../index";
import { z } from "zod";

const person = defineLayer({
  input: z.object({
    id: z.string(),
  }),
  resolver: async ({ input }) => {
    return {
      id: input.id,
      name: "John Doe",
      age: 20,
      books: books.withInput({ id: input.id }),
    };
  },
});

const books = defineLayer({
  input: z.object({
    id: z.string(),
  }),
  resolver: async ({ input }) => {
    return {
      items: [
        {
          id: "1",
          title: "The Great Gatsby",
          authorPersonId: "1",
        }
      ],
    };
  },
});

const book = defineLayer({
  input: z.object({
    id: z.string(),
  }),
  resolver: async (input) => {
    const bookData = {
      title: "The Great Gatsby",
      authorPersonId: "1",
    }

    return {
      title: "The Great Gatsby",
      author: person.withInput({ id: bookData.authorPersonId }),
    };
  }
});

const result = await book.withInput({ id: "1" }, { 
  author: {
    books: true
  } 
});

console.dir(result.author, { depth: null });
