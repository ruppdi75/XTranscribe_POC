
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
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;


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

// Internal schema for the prompt's output, where 'text' can be initially missing
// and text within segments can also be initially missing from the AI.
const TranscribeAudioPromptOutputInternalSchema = z.object({
  text: z.string().optional().describe('The full transcribed text of the audio (may be constructed from segments if not directly provided by model).'),
  segments: z.array(
      z.object({
        start: z.number().describe('The start time of the segment in seconds.'),
        end: z.number().describe('The end time of the segment in seconds.'),
        text: z.string().optional().describe('The transcribed text of the segment (optional from AI).'),
      })
    )
    .describe('An array of transcribed audio segments with timestamps.'),
});


// This is the exported function that the app calls.
export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  if (!input.audioDataUri) {
    console.error("TRANSFLOW_WRAPPER: Audio data URI is required.");
    throw new Error('Audio data URI is required.');
  }
  if (!input.language) {
    console.error("TRANSFLOW_WRAPPER: Language is required.");
    throw new Error('Language is required.');
  }
  // The flow will internally handle the schema difference and ensure final output matches TranscribeAudioOutputSchema
  return transcribeAudioFlow(input);
}

const transcribeAudioPrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscribeAudioInputSchema},
  output: {schema: TranscribeAudioPromptOutputInternalSchema}, // Use internal schema for AI output
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

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema, // Final output uses the strict schema
  },
  async (input): Promise<TranscribeAudioOutput> => {
    console.log(`TRANSFLOW: Starting transcription for language: ${input.language}. Input audio URI (first 100 chars): ${input.audioDataUri.substring(0,100)}...`);
    try {
      console.log("TRANSFLOW: Calling transcribeAudioPrompt...");
      const {output: promptOutput} = await transcribeAudioPrompt(input);
      console.log("TRANSFLOW: transcribeAudioPrompt returned. Output (type):", typeof promptOutput, "Is null/undefined:", promptOutput == null);


      if (!promptOutput) {
        console.error('TRANSFLOW: Transcription prompt output was null or undefined from AI model. This could be due to an API key issue, model availability, or network problems.');
        throw new Error('Transcription failed: AI model returned no output. Check server logs for API key status and model errors.');
      }

      let fullText = promptOutput.text || "";
      const rawSegments = promptOutput.segments || [];
      const segmentsToReturn: TranscriptSegment[] = []; // Conforms to the strict TranscriptSegmentSchema

      console.log(`TRANSFLOW: Received ${rawSegments.length} raw segments from AI.`);

      // Process segments, ensuring each has a 'text' field, defaulting to "" if missing.
      for (const rawSegment of rawSegments) {
        segmentsToReturn.push({
          start: rawSegment.start,
          end: rawSegment.end,
          text: rawSegment.text || "", // Default to empty string if text is missing from AI segment
        });
      }

      // If 'text' is missing or empty but 'segments' are present, construct 'text' from processed segments.
      if ((!fullText || fullText.trim() === "") && segmentsToReturn.length > 0) {
        console.log("TRANSFLOW: Full 'text' field was missing or empty from AI output, constructing from segments.");
        fullText = segmentsToReturn.map(segment => segment.text).join(' ').trim();
      }

      if (fullText.trim() === "" && segmentsToReturn.length === 0) {
         console.warn('TRANSFLOW: Transcription output is empty (no text and no segments). This might indicate silent audio or an issue with the source. It could also be a symptom of an underlying API or model issue.');
         // Return a structured empty response consistent with the schema
         return { text: '', segments: [] };
      }
      
      console.log(`TRANSFLOW: Transcription processing successful. Full text length: ${fullText.length}, Segments count: ${segmentsToReturn.length}. Returning final output.`);
      return { text: fullText, segments: segmentsToReturn };

    } catch (error) {
      console.error('TRANSFLOW: Error explicitly caught in transcribeAudioFlow. THIS IS A SERVER-SIDE LOG. PROVIDE THIS FULL ERROR WHEN REPORTING ISSUES:');
      // Log detailed error information
      if (error instanceof Error) {
        console.error('TRANSFLOW: Error Name:', error.name);
        console.error('TRANSFLOW: Error Message:', error.message);
        console.error('TRANSFLOW: Error Stack:', error.stack);
      } else {
        console.error('TRANSFLOW: Caught error is not an instance of Error:', error);
      }
      
      // Throw a simpler error to see if it gets serialized better by Next.js/Genkit
      // The detailed error is logged above on the server.
      throw new Error(`Server-side transcription flow failed. Check server logs for details (search for "TRANSFLOW: Error explicitly caught"). The most common cause is a missing or invalid GOOGLE_GENAI_API_KEY.`);
    }
  }
);

