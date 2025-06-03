
'use server';
/**
 * @fileOverview A Genkit flow for transcribing audio files.
 *
 * - transcribeAudio - A function that handles the audio transcription process.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const TranscriptSegmentSchema = z.object({
  start: z.number().describe('The start time of the segment in seconds.'),
  end: z.number().describe('The end time of the segment in seconds.'),
  text: z.string().describe('The transcribed text of the segment.'),
});

// Schema for the input to the flow and prompt
const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The audio file content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  language: z.string().describe('The language of the audio recording (e.g., "en", "de").'),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

// Final output schema for the flow (exported type) - text is REQUIRED here
const TranscribeAudioOutputSchema = z.object({
  text: z.string().describe('The full transcribed text of the audio.'),
  segments: z.array(TranscriptSegmentSchema).describe('An array of transcribed audio segments with timestamps.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

// Internal schema for the prompt's output, where 'text' can be initially missing if segments are provided
const TranscribeAudioPromptOutputInternalSchema = z.object({
  text: z.string().optional().describe('The full transcribed text of the audio (may be constructed from segments if not directly provided by model).'),
  segments: z.array(TranscriptSegmentSchema).describe('An array of transcribed audio segments with timestamps.'),
});


// This is the exported function that the app calls.
// It ensures the output conforms to TranscribeAudioOutput (where text is required)
export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  if (!input.audioDataUri) {
    throw new Error('Audio data URI is required.');
  }
  if (!input.language) {
    throw new Error('Language is required.');
  }
  // The flow will internally handle the schema difference and ensure final output matches TranscribeAudioOutputSchema
  return transcribeAudioFlow(input);
}

const transcribeAudioPrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscribeAudioInputSchema},
  // Use the internal schema for the prompt, allowing text to be optional initially
  output: {schema: TranscribeAudioPromptOutputInternalSchema},
  prompt: `You are an expert audio transcription service.
Transcribe the provided audio file. The language of the audio is '{{{language}}}'.

Your response JSON object MUST include:
1.  A 'segments' field: An array of timed segments, where each segment includes a 'start' time (in seconds), an 'end' time (in seconds), and the 'text' for that segment.
2.  Optionally, a 'text' field: The full, continuous transcribed text. If you do not provide this 'text' field directly, it will be constructed by concatenating all segment texts.

Audio details:
Language: {{{language}}}
Audio data: {{media url=audioDataUri}}`,
  config: {
    // Potentially adjust temperature for more factual transcription if needed
    // temperature: 0.2,
  },
});

// The flow definition. Note its outputSchema is the strict TranscribeAudioOutputSchema.
const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema, // Flow's public contract
  },
  async (input): Promise<TranscribeAudioOutput> => { // Ensure flow returns the stricter type
    console.log(`Starting transcription for language: ${input.language}`);
    try {
      // The 'result' from the prompt will conform to TranscribeAudioPromptOutputInternalSchema
      const {output: promptOutput} = await transcribeAudioPrompt(input);

      if (!promptOutput) {
        console.error('Transcription prompt output was null or undefined.');
        throw new Error('Transcription failed to produce an output from the prompt.');
      }

      let fullText = promptOutput.text || "";
      const segments = promptOutput.segments || [];

      // If 'text' is missing or empty but 'segments' are present, construct 'text' from segments.
      if ((!fullText || fullText.trim() === "") && segments.length > 0) {
        console.warn("Full 'text' field was missing or empty from AI output, constructing from segments.");
        fullText = segments.map(segment => segment.text).join(' ').trim();
      }

      // After constructing, check if we have meaningful output.
      if (fullText.trim() === "" && segments.length === 0) {
         console.warn('Transcription output is empty (no text and no segments).');
         // Return a structured empty response
         return { text: '', segments: [] };
      }
      
      console.log('Transcription successful.');
      // Ensure the returned object matches TranscribeAudioOutputSchema
      return { text: fullText, segments: segments };

    } catch (error) {
      console.error('Error during transcription flow:', error);
      // Provide a more specific error message if possible
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during transcription.';
      // Ensure the thrown error doesn't cause a new schema validation issue if it's not a string
      throw new Error(`Transcription failed: ${String(errorMessage)}`);
    }
  }
);

