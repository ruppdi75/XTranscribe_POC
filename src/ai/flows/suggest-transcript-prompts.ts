
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting relevant prompts for transcript summarization.
 *
 * - suggestTranscriptPrompts - A function that takes a transcript and suggests summarization prompts.
 * - SuggestTranscriptPromptsInput - The input type for the suggestTranscriptPrompts function.
 * - SuggestTranscriptPromptsOutput - The return type for the suggestTranscriptPrompts function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SuggestTranscriptPromptsInputSchema = z.object({
  transcript: z
    .string()
    .min(10) // Add minimum length
    .describe('The transcript content to analyze and suggest prompts for.'),
});
export type SuggestTranscriptPromptsInput = z.infer<
  typeof SuggestTranscriptPromptsInputSchema
>;

const SuggestTranscriptPromptsOutputSchema = z.object({
  suggestedPrompts: z
    .array(z.string())
    .min(1).max(3) // Expect 1 to 3 prompts
    .describe('An array of suggested prompts for summarizing the transcript.'),
});
export type SuggestTranscriptPromptsOutput = z.infer<
  typeof SuggestTranscriptPromptsOutputSchema
>;

// Default fallback prompts
const fallbackPrompts = [
    "Provide a concise summary of the main topic.",
    "List the key takeaways from this transcript.",
    "Identify any action items or decisions made.",
];


export async function suggestTranscriptPrompts(
  input: SuggestTranscriptPromptsInput
): Promise<SuggestTranscriptPromptsOutput> {
   // Basic validation before calling the flow
   if (!input.transcript || input.transcript.trim().length < 20) {
     console.warn("Transcript too short for prompt suggestions.");
     // Return fallback prompts if transcript is too short
     return { suggestedPrompts: fallbackPrompts.slice(0,1) }; // Return just one default
   }
  return suggestTranscriptPromptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTranscriptPromptsPrompt',
  input: {
    schema: z.object({
      transcript: z
        .string()
        .describe('The transcript content to analyze and suggest prompts for.'),
    }),
  },
  output: {
    // Use the updated schema expecting 1-3 prompts
    schema: SuggestTranscriptPromptsOutputSchema,
  },
  prompt: `You are an AI assistant designed to suggest prompts for summarizing transcripts.\nGiven the following transcript, suggest exactly three different, actionable prompts that could be used to generate a high-quality summary tailored to the content.\n\nTranscript:\n{{transcript}}\n\nSuggested Prompts (provide exactly 3):`,
});

const suggestTranscriptPromptsFlow = ai.defineFlow<
  typeof SuggestTranscriptPromptsInputSchema,
  typeof SuggestTranscriptPromptsOutputSchema
>({
  name: 'suggestTranscriptPromptsFlow',
  inputSchema: SuggestTranscriptPromptsInputSchema,
  outputSchema: SuggestTranscriptPromptsOutputSchema,
},
async input => {
   try {
        const {output} = await prompt(input);
        // Validate output before returning
        if (!output || !output.suggestedPrompts || output.suggestedPrompts.length === 0) {
            console.warn("AI prompt generation returned no suggestions, providing fallback.");
            return { suggestedPrompts: fallbackPrompts };
        }
        // Ensure the output conforms to the expected number of prompts (optional, depends on strictness)
        // if (output.suggestedPrompts.length > 3) {
        //     console.warn(`AI generated ${output.suggestedPrompts.length} prompts, expected 3. Truncating.`);
        //     return { suggestedPrompts: output.suggestedPrompts.slice(0, 3) };
        // }
         return output;
    } catch (error) {
        console.error("Error in suggestTranscriptPromptsFlow:", error);
        // Provide fallback prompts on error
        return { suggestedPrompts: fallbackPrompts };
    }
});

