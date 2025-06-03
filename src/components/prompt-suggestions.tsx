
'use client';

import type * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, WandSparkles, Save, Edit3, Settings2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input'; // Added Input for prompt names
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { smartPromptSuggestions } from '@/ai/flows/smart-prompt-suggestions';
import { cn } from '@/lib/utils';

interface PromptSuggestionsProps {
  transcript: string;
  onPromptSelect: (prompt: string) => void;
  disabled?: boolean;
}

interface CustomPromptEntry {
  name: string;
  content: string;
}

const MAX_CUSTOM_PROMPTS = 3;
const LOCAL_STORAGE_KEY = 'xtranscribe-customPrompts-v2'; // Changed key for new structure

const initialEmptyPrompts: CustomPromptEntry[] = Array(MAX_CUSTOM_PROMPTS).fill({ name: '', content: '' });

export function PromptSuggestions({ transcript, onPromptSelect, disabled = false }: PromptSuggestionsProps) {
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = useState(false);
  const { toast } = useToast();
  const [selectedAiPrompt, setSelectedAiPrompt] = useState<string>("");

  // State for custom prompts with names
  const [savedCustomPrompts, setSavedCustomPrompts] = useState<CustomPromptEntry[]>(initialEmptyPrompts);
  const [currentCustomPromptEntries, setCurrentCustomPromptEntries] = useState<CustomPromptEntry[]>(initialEmptyPrompts);


  // Load custom prompts from localStorage on initial render
  useEffect(() => {
    try {
      const storedPrompts = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedPrompts) {
        const parsedPrompts: unknown = JSON.parse(storedPrompts);
        if (
            Array.isArray(parsedPrompts) &&
            parsedPrompts.length === MAX_CUSTOM_PROMPTS &&
            parsedPrompts.every(p => typeof p === 'object' && p !== null && 'name' in p && 'content' in p && typeof p.name === 'string' && typeof p.content === 'string')
        ) {
          setSavedCustomPrompts(parsedPrompts as CustomPromptEntry[]);
          setCurrentCustomPromptEntries([...(parsedPrompts as CustomPromptEntry[])]);
        } else {
          // If data is malformed or old format, initialize with empty and save
          setSavedCustomPrompts([...initialEmptyPrompts]);
          setCurrentCustomPromptEntries([...initialEmptyPrompts]);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialEmptyPrompts));
        }
      } else {
        // If no data, initialize with empty and save
        setSavedCustomPrompts([...initialEmptyPrompts]);
        setCurrentCustomPromptEntries([...initialEmptyPrompts]);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialEmptyPrompts));
      }
    } catch (error) {
        console.error("Failed to load custom prompts from localStorage:", error);
        setSavedCustomPrompts([...initialEmptyPrompts]);
        setCurrentCustomPromptEntries([...initialEmptyPrompts]);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialEmptyPrompts));
    }
  }, []);

  // Clear AI suggestions and selection if transcript changes
  useEffect(() => {
    setAiSuggestions([]);
    setSelectedAiPrompt("");
  }, [transcript]);


  const handleSuggestPrompts = async () => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript || trimmedTranscript.length < 50) {
      toast({
        title: 'Transcript Too Short',
        description: 'Provide a transcript with at least 50 characters for relevant AI suggestions.',
        variant: 'default',
      });
      return;
    }

    setIsLoadingAiSuggestions(true);
    setAiSuggestions([]);
    setSelectedAiPrompt("");

    try {
      const result = await smartPromptSuggestions({ transcript: trimmedTranscript });
      if (result?.suggestedPrompts && result.suggestedPrompts.length > 0) {
        setAiSuggestions(result.suggestedPrompts);
        toast({
           title: 'AI Suggestions Ready',
           description: 'Select an AI-suggested prompt from the dropdown.',
        });
      } else {
        setAiSuggestions([]);
        toast({
          title: 'No AI Suggestions Generated',
          description: 'The AI couldn\'t generate specific suggestions for this transcript.',
          variant: 'default'
        });
      }
    } catch (error: any) {
      console.error('Error fetching smart suggestions:', error);
      setAiSuggestions([]);
      toast({
        title: 'AI Suggestion Error',
        description: error.message || 'Failed to fetch AI prompt suggestions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAiSuggestions(false);
    }
  };

  const handleAiPromptValueChange = (value: string) => {
    if (value === "placeholder") { // Assuming you might add a placeholder option
      setSelectedAiPrompt(value);
    } else {
      setSelectedAiPrompt(value);
      onPromptSelect(value);
    }
  };

  const handleCustomPromptEntryChange = (index: number, field: 'name' | 'content', value: string) => {
    const newEntries = [...currentCustomPromptEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setCurrentCustomPromptEntries(newEntries);
  };

  const handleSaveCustomPrompt = (index: number) => {
    const newSavedPrompts = [...savedCustomPrompts];
    newSavedPrompts[index] = { ...currentCustomPromptEntries[index] }; // Save a copy
    setSavedCustomPrompts(newSavedPrompts);
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSavedPrompts));
        toast({ title: `Custom Prompt '${currentCustomPromptEntries[index].name || `Slot ${index + 1}`}' Saved`, description: 'Your prompt and its name have been saved locally.' });
    } catch (error) {
        console.error("Failed to save custom prompts to localStorage:", error);
        toast({ title: 'Save Error', description: 'Could not save custom prompt to local storage.', variant: 'destructive' });
    }
  };

  const handleUseCustomPrompt = (index: number) => {
    if (currentCustomPromptEntries[index].content.trim()) {
      onPromptSelect(currentCustomPromptEntries[index].content);
      toast({ title: `Custom Prompt '${currentCustomPromptEntries[index].name || `Slot ${index + 1}`}' Applied`, description: 'The prompt has been set for summarization.' });
    } else {
      toast({ title: 'Empty Prompt Content', description: 'Cannot use a prompt with empty content.', variant: 'default' });
    }
  };

  const canSuggestAi = !isLoadingAiSuggestions && !disabled && transcript && transcript.trim().length >= 50;

  return (
    <Card className={cn("w-full", disabled && "opacity-50 pointer-events-none")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
           <Settings2 className="h-5 w-5 text-primary" />
           Configure Summarization Prompt
        </CardTitle>
        <CardDescription>Use AI suggestions or your saved custom prompts to guide the summary generation.</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* AI Prompt Suggestions Section */}
        <div className="space-y-3 p-4 border rounded-md bg-secondary/20">
            <div className="flex items-center gap-2">
                 <WandSparkles className="h-5 w-5 text-primary/80" />
                <h3 className="text-lg font-semibold">AI-Powered Suggestions</h3>
            </div>
            <p className="text-sm text-muted-foreground">
                Generate prompt ideas based on the current transcript content.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    onClick={handleSuggestPrompts}
                    disabled={!canSuggestAi}
                    className="w-full sm:w-auto"
                >
                    {isLoadingAiSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                    Suggest with AI
                </Button>
                <Select
                    onValueChange={handleAiPromptValueChange}
                    value={selectedAiPrompt}
                    disabled={isLoadingAiSuggestions || disabled || aiSuggestions.length === 0}
                >
                    <SelectTrigger
                        className="w-full flex-1"
                        aria-label="Select an AI-suggested prompt"
                    >
                        <SelectValue placeholder="Select an AI suggestion..." />
                    </SelectTrigger>
                    <SelectContent>
                        {aiSuggestions.map((prompt, index) => (
                        <SelectItem key={`ai-${index}`} value={prompt}>
                            {prompt}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {aiSuggestions.length === 0 && !isLoadingAiSuggestions && transcript && transcript.trim().length >= 50 && (
                <p className="text-xs text-muted-foreground pt-1">Click "Suggest with AI" to get ideas.</p>
            )}
            {transcript && transcript.trim().length < 50 && !disabled && (
                <p className="text-xs text-muted-foreground pt-1">Transcript is too short for AI suggestions (min. 50 characters).</p>
            )}
        </div>

        {/* Custom Prompts Section */}
        <div className="space-y-3 p-4 border rounded-md">
            <div className="flex items-center gap-2">
                 <Edit3 className="h-5 w-5 text-primary/80" />
                <h3 className="text-lg font-semibold">Your Saved Prompts</h3>
            </div>
             <p className="text-sm text-muted-foreground">
                Create and save up to {MAX_CUSTOM_PROMPTS} custom prompts (with names) for quick reuse. Edits are saved locally in your browser.
            </p>
            <div className="space-y-4">
            {Array.from({ length: MAX_CUSTOM_PROMPTS }).map((_, index) => {
                const currentEntry = currentCustomPromptEntries[index] || { name: '', content: ''};
                const savedEntry = savedCustomPrompts[index] || { name: '', content: ''};
                const hasUnsavedChanges = currentEntry.name !== savedEntry.name || currentEntry.content !== savedEntry.content;

                return (
                    <div key={`custom-prompt-${index}`} className="space-y-2 p-3 border rounded-md bg-secondary/20 relative group">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                            <Label htmlFor={`custom-prompt-name-${index}`} className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                <Tag className="h-3 w-3"/> Prompt Name (Slot {index + 1})
                            </Label>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleUseCustomPrompt(index)}
                                disabled={disabled || !currentEntry.content?.trim()}
                                className="w-full sm:w-auto sm:ml-auto" // Align button to the right on larger screens
                                aria-label={`Use custom prompt from slot ${index + 1}`}
                            >
                                Use this prompt
                            </Button>
                        </div>
                         <Input
                            id={`custom-prompt-name-${index}`}
                            value={currentEntry.name}
                            onChange={(e) => handleCustomPromptEntryChange(index, 'name', e.target.value)}
                            placeholder={`e.g., Executive Summary (Slot ${index + 1})`}
                            className="text-sm"
                            disabled={disabled}
                            aria-label={`Custom prompt name for slot ${index + 1}`}
                        />
                        <Label htmlFor={`custom-prompt-content-${index}`} className="text-sm font-medium text-muted-foreground mt-2 block">
                            Prompt Content
                        </Label>
                        <Textarea
                            id={`custom-prompt-content-${index}`}
                            value={currentEntry.content}
                            onChange={(e) => handleCustomPromptEntryChange(index, 'content', e.target.value)}
                            placeholder={`Enter your reusable prompt content for slot ${index + 1}...`}
                            className="min-h-[70px] text-sm"
                            disabled={disabled}
                            aria-label={`Custom prompt content for slot ${index + 1}`}
                        />
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSaveCustomPrompt(index)}
                                disabled={disabled || !hasUnsavedChanges}
                                className="w-full" // Make save button full width in its context
                                aria-label={`Save custom prompt name and content for slot ${index + 1}`}
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Save Prompt & Name
                            </Button>
                        </div>
                        {hasUnsavedChanges && (
                             <p className="text-xs text-amber-600 dark:text-amber-500 pt-1">You have unsaved changes in this slot.</p>
                        )}
                    </div>
                );
            })}
            </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
            Select or type a prompt. The chosen prompt will be used when you click "Generate Summary".
        </p>
      </CardFooter>
    </Card>
  );
}

    