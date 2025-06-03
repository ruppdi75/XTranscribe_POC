
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Loader2, Languages, UploadCloud, Youtube, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { FileUpload } from '@/components/file-upload';
import { TranscriptEditor } from '@/components/transcript-editor';
import { PromptSuggestions } from '@/components/prompt-suggestions';
import { SettingsPanel } from '@/components/settings-panel';
import { ExportIntegration } from '@/components/export-integration';
import { AudioPlayer, type AudioPlayerRef } from '@/components/audio-player';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { transcribeAudio, type TranscribeAudioOutput } from '@/ai/flows/transcribe-audio-flow';
import { smartPromptSuggestions, type SmartPromptSuggestionsOutput } from '@/ai/flows/smart-prompt-suggestions';
import { summarizeTranscriptWithPrompt, type SummarizeTranscriptOutput } from '@/ai/flows/summarize-transcript-flow';


// --- Types ---
interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

// Helper function to convert File to Data URI
async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

// --- Component ---

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [language, setLanguage] = useState('de'); // Default German
  const [summaryPrompt, setSummaryPrompt] = useState('');
  const [summary, setSummary] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isProcessingYouTube, setIsProcessingYouTube] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [youtubePlaceholderMessage, setYoutubePlaceholderMessage] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<number>(0);
  
  // For PromptSuggestions state reset
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [selectedAiPrompt, setSelectedAiPrompt] = useState<string>("");


  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

   useEffect(() => {
    let objectUrlToRevoke: string | null = null;

    if (selectedFile) {
      const newObjectUrl = URL.createObjectURL(selectedFile);
      setAudioSrc(newObjectUrl);
      objectUrlToRevoke = newObjectUrl; // Keep track of this specific URL for cleanup

      // Clear YouTube related states if a file is selected
      setYoutubeUrl('');
      setYoutubePlaceholderMessage(null);
      setIsProcessingYouTube(false);
    } else { // No selectedFile
      setAudioSrc(null); // Player component will react to src becoming null
      // Additional player reset logic for UI consistency (e.g. currentAudioTime)
      // is primarily handled by handleClearAndReset when a file is actively cleared.
      // If selectedFile becomes null by other means, AudioPlayer's internal useEffect[src] handles pause/load.
    }

    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [selectedFile, isProcessingFile]); // Corrected dependency array: removed audioSrc


  const handleClearAndReset = () => {
    console.log("handleClearAndReset: Called");

    if (progressIntervalRef.current) {
        console.log("handleClearAndReset: Clearing active transcription progress interval", progressIntervalRef.current);
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
    }
    setIsProcessingFile(false);
    setTranscriptionProgress(0);
    setSelectedFile(null); // This triggers the useEffect above for audioSrc and player reset

    setYoutubeUrl('');
    setYoutubePlaceholderMessage(null);
    setIsProcessingYouTube(false);

    setTranscriptSegments([]);
    setFullTranscript("");
    setSummary("");
    setSummaryPrompt("");
    setSelectedAiPrompt(""); 
    setAiSuggestions([]);

    setCurrentAudioTime(0);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.seekTo(0);
    }

    toast({ title: 'Form Cleared', description: 'Ready for a new file or YouTube URL.' });
  };


  const handleFileSelected = (file: File) => {
     console.log("handleFileSelected: New file selected by FileUpload component:", file.name);
     // Ensure any YouTube mode is cleared before processing file
     if (youtubeUrl.trim() || youtubePlaceholderMessage) {
        handleClearAndReset(); // Clears everything, including YT states
        // setSelectedFile(file) will be called again by the re-render after this reset,
        // so we call handleProcessFile in a timeout to ensure state is settled.
        setTimeout(() => {
            setSelectedFile(file); // Set the file again after reset
            handleProcessFile(file, language);
        }, 0);
     } else {
        setSelectedFile(file); 
        // Use timeout to ensure state update for selectedFile has rendered before processing
        setTimeout(() => handleProcessFile(file, language), 0);
     }
   };


  const handleYouTubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setYoutubeUrl(newUrl);

    if (newUrl.trim()) {
      if (selectedFile || isProcessingFile) { 
          handleClearAndReset(); 
      }
      // Only clear messages and transcript if user is actively typing a new URL
      // (not if it's just a re-render with existing URL)
      setYoutubePlaceholderMessage(null); 
      setTranscriptSegments([]);
      setFullTranscript("");
      setSummary("");
      setAudioSrc(null); // Ensure audio player is cleared
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.seekTo(0);
      }
    } else { // YouTube URL is empty
      setYoutubePlaceholderMessage(null); // Clear placeholder if URL is erased
      // Optionally, if clearing YT URL means going back to "no input" state,
      // and no file is selected, could call handleClearAndReset()
      // For now, this just clears the placeholder.
    }
  };

  const handleProcessFile = async (fileToProcess: File, langToUse: string) => {
     if (!fileToProcess) {
       console.warn("handleProcessFile: fileToProcess is null, exiting.");
       return;
     }
     console.log(`handleProcessFile: Starting for file: "${fileToProcess.name}", Language: ${langToUse}`);

     setIsProcessingFile(true);
     setTranscriptSegments([]);
     setFullTranscript("");
     setSummary("");
     setTranscriptionProgress(0);
     setCurrentAudioTime(0);

     if (audioPlayerRef.current) { // Ensure player is reset for new file
         audioPlayerRef.current.pause();
         audioPlayerRef.current.seekTo(0);
     }
     
     setYoutubeUrl(''); // Explicitly clear YouTube URL if file is processed
     setYoutubePlaceholderMessage(null);
     setIsProcessingYouTube(false);

     if (progressIntervalRef.current) {
       console.warn("handleProcessFile: Clearing pre-existing progress interval", progressIntervalRef.current);
       clearInterval(progressIntervalRef.current);
       progressIntervalRef.current = null;
     }

     console.log("handleProcessFile: Setting up new progress simulation interval...");
     let currentProgress = 0;
     progressIntervalRef.current = setInterval(() => {
       currentProgress += 5; // Simulate progress
       if (currentProgress < 95) { // Hold at 95 until actual completion
         setTranscriptionProgress(currentProgress);
         console.log("handleProcessFile: Interval tick - currentProgress:", currentProgress);
       } else {
         setTranscriptionProgress(95); // Cap simulation before actual result
       }
     }, 300); // Adjust interval timing as needed

     toast({ title: 'Processing File...', description: `Starting transcription of ${fileToProcess.name}. This may take a few moments.` });

     try {
       console.log("handleProcessFile: TRY block - Converting file to Data URI...");
       const audioDataUri = await fileToDataUri(fileToProcess);
       console.log("handleProcessFile: TRY block - Calling transcribeAudio Genkit flow...");
       const result: TranscribeAudioOutput = await transcribeAudio({ audioDataUri, language: langToUse });

       console.log("handleProcessFile: TRY block - Transcription result received.");
       console.log("handleProcessFile: TRY block - Raw AI Result:", JSON.stringify(result, null, 2));
       
       if (progressIntervalRef.current) {
         console.log("handleProcessFile: TRY block - Clearing progress interval (on success)", progressIntervalRef.current);
         clearInterval(progressIntervalRef.current);
         progressIntervalRef.current = null;
       }
       setTranscriptionProgress(100); 
       console.log("handleProcessFile: TRY block - setTranscriptionProgress(100)");

       setTranscriptSegments(result?.segments || []);
       setFullTranscript(result?.text || "");
       console.log("handleProcessFile: TRY block - Transcript data set. Full text length:", result?.text?.length);
       console.log("handleProcessFile: TRY block - Segments count:", result?.segments?.length);

        if ((!result?.text || result.text.trim() === "") && (!result?.segments || result.segments.length === 0)) {
            toast({ title: 'Processing Note', description: 'Transcription complete, but the AI returned no content. The audio might be silent or in an unsupported format/language for the AI model.', variant: 'default', duration: 7000 });
        } else {
            toast({ title: 'Processing Complete', description: 'Transcript generated successfully.' });
        }
     } catch (error: any) {
       console.error('handleProcessFile: CATCH block - Error processing file:', error.message, error.stack);
       console.error('handleProcessFile: CATCH block - Full error object:', error);
       
       if (progressIntervalRef.current) {
         console.log("handleProcessFile: CATCH block - Clearing progress interval (on error)", progressIntervalRef.current);
         clearInterval(progressIntervalRef.current);
         progressIntervalRef.current = null;
       }
       setTranscriptionProgress(0); 
       console.log("handleProcessFile: CATCH block - setTranscriptionProgress(0)");
       
       setTranscriptSegments([]);
       setFullTranscript("");
       console.log("handleProcessFile: CATCH block - Transcript states cleared after error.");
        toast({
         title: 'Processing Error',
         description: `Failed to process file: ${error.message || 'Please try again.'}`,
         variant: 'destructive',
       });
     } finally {
       console.log("handleProcessFile: FINALLY block executing.");
       setIsProcessingFile(false); 
       console.log("handleProcessFile: FINALLY block - Set isProcessingFile(false).");
       // Progress bar will disappear because isProcessingFile is false. 
       // No need to reset transcriptionProgress to 0 here immediately if it hit 100.
       // If it errored, it was already set to 0.
       // Consider a slight delay if 100% needs to be visible longer on success.
       // For now, the change in isProcessingFile will hide it.
     }
   };

  const handleProcessYouTubeUrl = async () => {
    if (!youtubeUrl.trim()) {
      toast({ title: 'No URL', description: 'Please enter a YouTube video URL.', variant: 'default' });
      return;
    }
    console.log("handleProcessYouTubeUrl: Called with URL:", youtubeUrl);
    
    // Ensure file mode is fully reset if switching to YouTube
    if (selectedFile || isProcessingFile) {
      handleClearAndReset(); // This will clear selectedFile, audioSrc, etc.
    }
    
    setIsProcessingYouTube(true); 
    setIsProcessingFile(false); // Ensure file processing is off
    if (progressIntervalRef.current) { // Clear file processing interval if it was running
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
    }
    setTranscriptionProgress(0); // Reset file transcription progress

    setAudioSrc(null); // Clear audio player source
    setTranscriptSegments([]);
    setFullTranscript("");
    setSummary("");
    setCurrentAudioTime(0);
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.seekTo(0);
    }
    
    const placeholderText = `Full transcription for YouTube URLs (like "${youtubeUrl}") is a feature currently under development and not yet functional.\n\n` +
                              "This is because it requires a backend service to fetch and process the video's audio, which is beyond the current scope.\n\n" +
                              "Please use the file upload feature for transcription at this time.";
    
    setYoutubePlaceholderMessage(placeholderText);
    console.log("handleProcessYouTubeUrl: Placeholder message set.");

    toast({
      title: 'YouTube Feature Not Active',
      description: "Actual transcription for YouTube URLs is not yet implemented. This is a placeholder. Please use file upload.",
      variant: 'default',
      duration: 8000,
    });

    // Simulate a brief processing indication for YT button
    setTimeout(() => setIsProcessingYouTube(false), 500); 
  };


  const handleSummarize = async () => {
    if (!fullTranscript.trim() || youtubePlaceholderMessage) {
      toast({ title: 'Not Ready for Summary', description: 'No transcript available or YouTube placeholder active.', variant: 'default' });
      return;
    }
    if (!summaryPrompt.trim()) {
      toast({ title: 'No Prompt Provided', description: 'Please enter or select a summarization prompt.', variant: 'default' });
      return;
    }

    setIsSummarizing(true);
    setSummary('');
    console.log("handleSummarize: Starting summarization with prompt:", summaryPrompt);

    try {
      const result: SummarizeTranscriptOutput = await summarizeTranscriptWithPrompt({
        transcript: fullTranscript,
        customPrompt: summaryPrompt,
      });
      setSummary(result.summary);
      console.log("handleSummarize: Summarization complete. Summary length:", result.summary?.length);
      toast({ title: 'Summarization Complete' });
    } catch (error: any)      { 
      console.error('Error summarizing transcript:', error);
      toast({
        title: 'Summarization Error',
        description: error.message || 'Failed to generate summary. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSummarizing(false);
    }
  };

   const handleSegmentClick = useCallback((startTime: number) => {
    if (audioPlayerRef.current && !youtubePlaceholderMessage && audioSrc) {
        audioPlayerRef.current.seekTo(startTime);
    }
   }, [youtubePlaceholderMessage, audioSrc]);

   const handleAudioTimeUpdate = useCallback((time: number) => {
     setCurrentAudioTime(time);
   }, []);


  if (!isClient) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  const isAnyProcessingActive = isProcessingFile || isProcessingYouTube;
  const isTranscriptAvailable = (fullTranscript.trim().length > 0 || transcriptSegments.length > 0) && !youtubePlaceholderMessage && !isProcessingFile;
  
  const fileUploadDisabled = isAnyProcessingActive || !!youtubeUrl.trim();
  const languageSelectDisabled = isProcessingFile || !!youtubeUrl.trim();
  const youtubeInputDisabled = isAnyProcessingActive || !!selectedFile;
  const processYoutubeButtonDisabled = !youtubeUrl.trim() || isAnyProcessingActive || !!selectedFile;
  const featuresRequiringTranscriptDisabled = !isTranscriptAvailable || isSummarizing || isProcessingFile;
  const clearAndResetDisabled = isProcessingFile || isProcessingYouTube || isSummarizing;


  const fileUploadMaxSize = 1024 * 1024 * 1024; // 1GB


  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-4">
        <h1 className="text-3xl font-bold text-primary text-center sm:text-left">XTranscribe</h1>
        <div className="flex gap-2 items-center"> {/* Wrapper for buttons */}
          <Button
            variant="outline"
            onClick={handleClearAndReset}
            disabled={clearAndResetDisabled}
            size="sm" 
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Clear & Start New
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Open Settings</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <SettingsPanel fontSize={fontSize} onFontSizeChange={setFontSize} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Provide Audio/Video</CardTitle>
              <CardDescription>Upload (Max {Math.floor(fileUploadMaxSize / (1024*1024))}MB) or use YouTube URL (placeholder).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="language-select" className="flex items-center gap-2">
                   <Languages className="h-4 w-4 text-muted-foreground"/>
                   Language of Recording (for file uploads)
                </Label>
                 <Select value={language} onValueChange={(value) => {
                      setLanguage(value);
                      if (selectedFile && !isProcessingFile && !youtubeUrl.trim() && !youtubePlaceholderMessage) {
                          toast({title: "Language Changed", description: `Language set to ${value}. Re-process file if needed.`})
                      }
                    }} disabled={languageSelectDisabled}>
                    <SelectTrigger id="language-select">
                    <SelectValue placeholder="Select language..." />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="de">Deutsch (German)</SelectItem>
                    <SelectItem value="en">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es">Español (Spanish)</SelectItem>
                    <SelectItem value="fr">Français (French)</SelectItem>
                    <SelectItem value="it">Italiano (Italian)</SelectItem>
                    <SelectItem value="ja">日本語 (Japanese)</SelectItem>
                    <SelectItem value="ko">한국어 (Korean)</SelectItem>
                    <SelectItem value="pt-BR">Português (Brazilian)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <FileUpload
                onFileSelect={handleFileSelected}
                supportedFormats={['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.mp4', '.mov', '.avi', '.webm', '.mpeg']}
                maxSize={fileUploadMaxSize}
                currentFile={selectedFile}
                onRemoveFile={handleClearAndReset} 
                disabled={fileUploadDisabled}
              />
              
              <div className="my-4 text-center text-sm text-muted-foreground flex items-center before:flex-1 before:border-t before:border-border after:flex-1 after:border-t after:border-border">
                 <span className="px-2">OR</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="youtube-url-input" className="flex items-center gap-2">
                   <Youtube className="h-4 w-4 text-muted-foreground"/>
                   YouTube Video URL (Placeholder Feature)
                </Label>
                <Input
                  id="youtube-url-input"
                  type="url"
                  placeholder="e.g., https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={handleYouTubeUrlChange}
                  disabled={youtubeInputDisabled}
                />
                <Button
                  onClick={handleProcessYouTubeUrl}
                  disabled={processYoutubeButtonDisabled}
                  className="w-full mt-2"
                >
                  {isProcessingYouTube ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Process YouTube URL
                </Button>
                 {youtubeUrl.trim() && !isProcessingYouTube && !youtubePlaceholderMessage && !selectedFile && (
                    <p className="text-xs text-muted-foreground pt-1">Note: Full YouTube transcription is a placeholder. Click "Process" for details.</p>
                 )}
              </div>
            </CardContent>
          </Card>

            <AudioPlayer
                ref={audioPlayerRef}
                src={audioSrc}
                onTimeUpdate={handleAudioTimeUpdate}
                className={cn( (isProcessingYouTube || youtubePlaceholderMessage || isProcessingFile) && "opacity-50 pointer-events-none")}
             />

        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>2. Review Transcript</CardTitle>
              <CardDescription>
                {isProcessingFile ? (
                  <div className="space-y-2 text-center">
                    <Progress value={transcriptionProgress} className="w-full h-2" aria-label="Transcription progress"/>
                    <p className="text-sm text-primary">
                      Transcribing with AI, please wait... This may take a few moments. ({Math.round(transcriptionProgress)}%)
                    </p>
                  </div>
                ) : youtubePlaceholderMessage ? (
                  "YouTube placeholder active. No audio/transcript available."
                ) : (selectedFile && !isProcessingFile && isTranscriptAvailable) ? (
                  "Click text to jump to audio. Editing disabled."
                ) : (!selectedFile && !youtubeUrl.trim() && !isProcessingFile && !youtubePlaceholderMessage) ? (
                  "Upload a file or provide a URL to start."
                ) : (
                  "Transcript will appear here..."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TranscriptEditor
                segments={transcriptSegments}
                fullTranscriptPlaceholder={
                  youtubePlaceholderMessage || 
                  (isProcessingFile ? "" : 
                   (!selectedFile && !youtubeUrl.trim() && !isProcessingFile && !youtubePlaceholderMessage) ? "Transcript will appear here once a file is processed..." :
                   (youtubeUrl.trim() && !youtubePlaceholderMessage && !isProcessingFile) ? "Click 'Process YouTube URL' above to see placeholder details." :
                   "Transcript will appear here..."
                  )
                }
                fontSize={fontSize}
                onSegmentClick={handleSegmentClick}
                currentTime={currentAudioTime}
                aria-label="Transcript Viewer"
                className="min-h-[200px] lg:min-h-[300px]"
                style={{ display: isProcessingFile ? 'none' : 'block' }} 
              />
            </CardContent>
          </Card>

          <PromptSuggestions
              transcript={fullTranscript}
              onPromptSelect={setSummaryPrompt}
              disabled={featuresRequiringTranscriptDisabled}
          />

          <Card>
            <CardHeader>
              <CardTitle>3. Generate Summary</CardTitle>
              <CardDescription>Use a suggested or custom prompt to create a summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <Textarea
                  placeholder="Enter your custom summarization prompt here, or select a suggestion above..."
                  value={summaryPrompt}
                  onChange={(e) => setSummaryPrompt(e.target.value)}
                  className="min-h-[80px]"
                  aria-label="Summarization Prompt Input"
                  disabled={featuresRequiringTranscriptDisabled}
               />
              <Button
                onClick={handleSummarize}
                disabled={featuresRequiringTranscriptDisabled || !summaryPrompt.trim()}
                className="w-full sm:w-auto"
              >
                {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Summary
              </Button>
               {(isSummarizing || summary) && isTranscriptAvailable && ( 
                 <Card className="bg-secondary mt-4">
                   <CardHeader>
                     <CardTitle className="text-lg">Generated Summary</CardTitle>
                   </CardHeader>
                   <CardContent>
                     {isSummarizing ? (
                       <div className="flex items-center justify-center text-muted-foreground">
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                       </div>
                     ) : (
                       <div className="whitespace-pre-wrap text-sm font-sans" dangerouslySetInnerHTML={{ __html: summary }} />
                     )}
                   </CardContent>
                 </Card>
               )}
            </CardContent>
          </Card>

           <ExportIntegration
              transcript={fullTranscript ?? ''}
              summary={summary ?? ''}
              fileNameBase={selectedFile?.name.split('.').slice(0, -1).join('.') || (youtubeUrl ? 'youtube-transcribe-export' : 'xtranscribe-export')}
              disabled={featuresRequiringTranscriptDisabled}
           />

        </div>
      </div>
    </div>
  );
}
    
 
