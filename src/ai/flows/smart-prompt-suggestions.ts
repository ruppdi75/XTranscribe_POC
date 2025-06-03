'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting smart prompts for transcript summarization.
 * 
 * - smartPromptSuggestions - A function that takes a transcript and suggests smart prompts for summarization.
 * - SmartPromptSuggestionsInput - The input type for the smartPromptSuggestions function.
 * - SmartPromptSuggestionsOutput - The return type for the smartPromptSuggestions function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SmartPromptSuggestionsInputSchema = z.object({
  transcript: z
    .string()
    .min(10) // Add a minimum length to ensure there's content to analyze
    .describe('The transcript content to analyze and suggest prompts for.'),
});
export type SmartPromptSuggestionsInput = z.infer<
  typeof SmartPromptSuggestionsInputSchema
>;

const SmartPromptSuggestionsOutputSchema = z.object({
  suggestedPrompts: z
    .array(z.string())
    // Ensure at least one prompt is suggested if possible, up to a reasonable max
    .min(1).max(5)
    .describe('An array of diverse and relevant prompts for summarizing the transcript.'),
});
export type SmartPromptSuggestionsOutput = z.infer<
  typeof SmartPromptSuggestionsOutputSchema
>;

export async function smartPromptSuggestions(
  input: SmartPromptSuggestionsInput
): Promise<SmartPromptSuggestionsOutput> {
   // Basic validation before calling the flow
   if (!input.transcript || input.transcript.trim().length < 20) {
     console.warn("Transcript too short for smart prompt suggestions.");
     // Return empty array or a default suggestion if needed
     return { suggestedPrompts: ["Provide a concise summary of the main topic."] };
   }
  return smartPromptSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartPromptSuggestionsPrompt',
  input: {
    schema: z.object({
      transcript:
        z.string()
        .describe('The transcript content to analyze and suggest prompts for.'),
    }),
  },
  output: {
    // Using the refined output schema
    schema: SmartPromptSuggestionsOutputSchema,
  },
  // Updated Prompt for better, more diverse suggestions
  prompt: `Analyze the following transcript and suggest 3-5 diverse and actionable prompts for generating different types of summaries. Focus on extracting key information, decisions, action items, or specific themes present in the text. Ensure the prompts encourage summaries beyond just a generic overview.

Consider these types of prompts:
1.  **Action-Oriented:** Ask for specific tasks, decisions, or next steps mentioned.
2.  **Topic-Specific:** Focus on the main subjects or themes discussed.
3.  **Question-Based:** Frame a question that the summary should answer based on the content.
4.  **Audience-Specific:** Suggest summarizing for a particular audience (e.g., executives, technical team).
5.  **Conciseness:** Ask for a very brief summary (e.g., one sentence, bullet points).

Transcript:
{{transcript}}

Suggested Prompts (provide between 3 and 5):`,
});

const smartPromptSuggestionsFlow = ai.defineFlow<
  typeof SmartPromptSuggestionsInputSchema,
  typeof SmartPromptSuggestionsOutputSchema
>({
  name: 'smartPromptSuggestionsFlow',
  inputSchema: SmartPromptSuggestionsInputSchema,
  outputSchema: SmartPromptSuggestionsOutputSchema,
}, 
async input => {
  try {
     const {output} = await prompt(input);
     // Ensure output is not null and fits the schema, provide fallback if needed
     if (!output || !output.suggestedPrompts || output.suggestedPrompts.length === 0) {
       console.warn("Smart prompt generation returned no suggestions, providing fallback.");
       return { suggestedPrompts: ["Summarize the key points.", "List any action items mentioned.", "What was the main topic discussed?"] };
     }
     return output;
  } catch (error) {
     console.error("Error in smartPromptSuggestionsFlow:", error);
     // Provide a fallback on error
      return { suggestedPrompts: ["Summarize the key points.", "List any action items mentioned."] };
  }

});

