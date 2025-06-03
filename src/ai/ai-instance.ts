
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY;

if (!apiKey) {
  console.error("FATAL AI INIT ERROR: GOOGLE_GENAI_API_KEY is not set in the environment. Genkit AI features will not work.");
  // It might be useful to throw an error here during development to make this unmissable
  // throw new Error("FATAL AI INIT ERROR: GOOGLE_GENAI_API_KEY is not set.");
} else {
  // Avoid logging the key itself for security reasons.
  console.log("AI INIT: Google GenAI API Key is configured (presence check passed).");
}

export const ai = genkit({
  promptDir: './prompts',
  plugins: [
    googleAI({
      apiKey: apiKey, // Use the checked apiKey variable
    }),
  ],
  model: 'googleai/gemini-2.0-flash', // Default model for general generate calls if not specified
});
