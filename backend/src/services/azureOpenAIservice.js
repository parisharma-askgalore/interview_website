import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const client = new OpenAI({

  apiKey:
    process.env.AZURE_OPENAI_API_KEY,

  baseURL:
    `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,

  defaultQuery: {
    "api-version":
      process.env.AZURE_OPENAI_API_VERSION
  },

  defaultHeaders: {
    "api-key":
      process.env.AZURE_OPENAI_API_KEY
  }

});

export default client;