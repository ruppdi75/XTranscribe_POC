
'use server';
/**
 * @fileOverview A Genkit flow for summarizing transcripts based on a custom prompt.
 *
 * - summarizeTranscriptWithPrompt - A function that takes a transcript and a custom prompt, then returns a summary.
 * - SummarizeTranscriptInput - The input type for the summarizeTranscriptWithPrompt function.
 * - SummarizeTranscriptOutput - The return type for the summarizeTranscriptWithPrompt function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SummarizeTranscriptInputSchema = z.object({
  transcript: z.string().min(1, "Transcript cannot be empty.").describe('The full transcript text to be summarized.'),
  customPrompt: z.string().min(1, "Summarization prompt cannot be empty.").describe('The user-provided prompt to guide the summarization process.'),
});
export type SummarizeTranscriptInput = z.infer<typeof SummarizeTranscriptInputSchema>;

const SummarizeTranscriptOutputSchema = z.object({
  summary: z.string().describe('The generated summary of the transcript, potentially including simple HTML for formatting and Unicode emojis.'),
});
export type SummarizeTranscriptOutput = z.infer<typeof SummarizeTranscriptOutputSchema>;

export async function summarizeTranscriptWithPrompt(
  input: SummarizeTranscriptInput
): Promise<SummarizeTranscriptOutput> {
  // Validate input before calling the flow to provide early feedback if possible
  const validationResult = SummarizeTranscriptInputSchema.safeParse(input);
  if (!validationResult.success) {
    // Combine all error messages for a comprehensive error
    const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join('; ');
    console.error("Invalid input for summarization:", errorMessage);
    // It's better to throw an error that can be caught by the caller
    // Or, return a structured error if the function signature allows (here it doesn't directly for summary string)
    // For this structure, we might let the flow handle it or throw here.
    // Let's throw, so the calling UI can catch it.
    throw new Error(`Invalid input: ${errorMessage}`);
  }
  return summarizeTranscriptFlow(validationResult.data);
}

const summaryGenerationPrompt = ai.definePrompt({
  name: 'summarizeTranscriptPrompt',
  input: {schema: SummarizeTranscriptInputSchema},
  output: {schema: SummarizeTranscriptOutputSchema},
  prompt: `You are an expert summarization assistant.
Your task is to summarize the provided transcript.
Use the instructions given in the "Custom Prompt" to guide how you create the summary.

Format your output:
- Use actual Unicode emojis directly in the text (e.g., 📝 for notepad, 📢 for loudspeaker, ⚖️ for balance scale, 🔧 for wrench). Do NOT use colon-codes like :spiral_notepad:.
- Use simple HTML tags for formatting: <strong>text</strong> for bold and <em>text</em> for italics. Do NOT use Markdown (e.g., do not use **text** or *text*).
- Ensure the output is a single block of text, potentially with multiple paragraphs using <p> tags if appropriate, but the entire summary should be one string.
- Be concise with whitespace. Avoid excessive empty lines or multiple consecutive paragraph breaks. Use single paragraph breaks between distinct points or sections where necessary for readability.

Transcript:
"""
{{{transcript}}}
"""

Custom Prompt:
"""
{{{customPrompt}}}
"""

Please generate the summary strictly following the Custom Prompt based on the Transcript, using the specified HTML, Unicode emoji formatting, and whitespace guidelines.`,
  config: {
    temperature: 0.5, // Slightly more deterministic to follow formatting closely
    // safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }] // Example safety setting if needed
  },
});

const summarizeTranscriptFlow = ai.defineFlow(
  {
    name: 'summarizeTranscriptFlow',
    inputSchema: SummarizeTranscriptInputSchema,
    outputSchema: SummarizeTranscriptOutputSchema,
  },
  async (input) => {
    // Input is already validated by the wrapper function.
    // Additional checks for empty strings might be redundant but safe.
    if (!input.transcript.trim()) {
      // This case should ideally be caught by Zod's .min(1)
      return { summary: "Cannot summarize an empty transcript. Please provide some text." };
    }
    if (!input.customPrompt.trim()) {
      // Also should be caught by Zod
      return { summary: "Cannot summarize without a guiding prompt. Please provide instructions." };
    }

    try {
      const {output} = await summaryGenerationPrompt(input);
      if (!output || typeof output.summary !== 'string') { // Check if output is null or not structured as expected
        console.error('Summary generation returned invalid output:', output);
        throw new Error('Summary generation failed to produce a valid output structure.');
      }
      if (output.summary.trim() === "") {
        // Handle cases where the AI might return an empty summary despite valid inputs
        console.warn("AI returned an empty summary. This might indicate an issue with the prompt or model behavior.");
        return { summary: "The AI generated an empty summary. You might want to rephrase your prompt or check the transcript content." };
      }
      return output;
    } catch (error) {
      console.error("Error during summary generation flow:", error);
      // Re-throw the error or return a structured error message
      // For this example, we'll re-throw to let the caller handle UI updates.
      // A more user-friendly message could be crafted here.
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
