import { defineLayer } from "../index";
import { z } from "zod";

const person = defineLayer({
  input: z.object({
    id: z.string(),
  }),
  resolver: async (input) => {
    return {
      name: "John Doe",
      age: 20,
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
  },
});

const result = await book.withInput({ id: "1" }, { 
  author: true 
});

console.dir(result, { depth: null });
