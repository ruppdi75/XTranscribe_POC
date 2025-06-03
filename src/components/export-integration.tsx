
'use client';

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { Download, Send, Loader2, Copy } from 'lucide-react'; // Added Copy icon
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { createNotionPage } from '@/services/notion';
import { createConfluencePage } from '@/services/confluence';
import { cn } from '@/lib/utils';
import { saveAs } from 'file-saver';

interface ExportIntegrationProps {
  transcript: string;
  summary: string;
  fileNameBase?: string;
  disabled?: boolean;
}

type IntegrationService = 'notion' | 'confluence';

export function ExportIntegration({
  transcript,
  summary,
  fileNameBase = 'xtranscribe-export',
  disabled = false,
}: ExportIntegrationProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false); // State for copy button
  const [integrationLoading, setIntegrationLoading] = useState<IntegrationService | null>(null);
  
  const [pageTitle, setPageTitle] = useState(`${fileNameBase} ${new Date().toLocaleDateString()}`);
  const [customizeTxtFilename, setCustomizeTxtFilename] = useState(false);
  const [txtCustomName, setTxtCustomName] = useState('');

  useEffect(() => {
    setPageTitle(`${fileNameBase} ${new Date().toLocaleDateString()}`);
    if (customizeTxtFilename) {
      setTxtCustomName(`${fileNameBase} ${new Date().toLocaleDateString()}`);
    } else {
       setTxtCustomName('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileNameBase]);


  const handleExportTxt = () => {
    if (disabled) {
        toast({ title: 'Nothing to Export', description: 'Generate a transcript or summary first.', variant: 'default' });
        return;
    }

    setIsDownloading(true);
    try {
      const contentToExport = summary
        ? `SUMMARY:\n${summary}\n\n---\n\nTRANSCRIPT:\n${transcript}`
        : `TRANSCRIPT:\n${transcript}`;

      if (!contentToExport.trim()) {
          toast({ title: 'Nothing to Export', description: 'Content is empty.', variant: 'default' });
          setIsDownloading(false);
          return;
      }

      let chosenFileNameBase = pageTitle.trim();
      if (customizeTxtFilename && txtCustomName.trim()) {
        chosenFileNameBase = txtCustomName.trim();
      }
      if (!chosenFileNameBase) {
        chosenFileNameBase = fileNameBase; 
      }
      
      const safeFileName = chosenFileNameBase.replace(/[^a-z0-9_\-\s]/gi, '_').substring(0, 50);
      const filename = `${safeFileName}_${new Date().toISOString().split('T')[0]}.txt`;
      
      const blob = new Blob([contentToExport], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, filename);
      toast({ title: 'Export Successful', description: `File saved as ${filename}.` });
    } catch (error: any) {
      console.error('Error exporting text:', error);
      toast({ title: 'Export Failed', description: error.message || 'Could not save the text file.', variant: 'destructive' });
    } finally {
      setTimeout(() => setIsDownloading(false), 500);
    }
  };

  const handleCopyToClipboard = async () => {
    if (disabled) {
      toast({ title: 'Nothing to Copy', description: 'Generate a transcript or summary first.', variant: 'default' });
      return;
    }

    const contentToCopy = summary.trim() || transcript.trim();

    if (!contentToCopy) {
      toast({ title: 'Nothing to Copy', description: 'Content is empty.', variant: 'default' });
      return;
    }

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(contentToCopy);
      toast({ title: 'Copied to Clipboard!', description: summary.trim() ? 'Summary copied.' : 'Transcript copied.' });
    } catch (error: any) {
      console.error('Error copying to clipboard:', error);
      toast({ title: 'Copy Failed', description: 'Could not copy content to clipboard. Check browser permissions.', variant: 'destructive' });
    } finally {
      setTimeout(() => setIsCopying(false), 1000); // Keep feedback for a bit
    }
  };


  const handleIntegration = async (service: IntegrationService) => {
     if (disabled) {
        toast({ title: 'Nothing to Integrate', description: 'Generate a summary or transcript first.', variant: 'default' });
        return;
    }
     const effectivePageTitle = pageTitle.trim() || fileNameBase; 
     if (!effectivePageTitle.trim()) { 
        toast({ title: 'Title Required', description: `Please enter a title for the ${service} page.`, variant: 'destructive' });
        return;
    }

    setIntegrationLoading(service);
    try {
      let response;
      const content = summary
        ? `## Summary\n\n${summary}\n\n---\n\n## Transcript\n\n${transcript}`
        : `## Transcript\n\n${transcript}`;

       if (!content.trim()) {
            toast({ title: 'Nothing to Integrate', description: 'Content is empty.', variant: 'default' });
            setIntegrationLoading(null);
            return;
       }

      const requestData = { title: effectivePageTitle, content };

      if (service === 'notion') {
        response = await createNotionPage(requestData);
      } else { 
        response = await createConfluencePage(requestData);
      }

      if (response.success) {
        toast({
          title: `${service.charAt(0).toUpperCase() + service.slice(1)} Page Created`,
          description: (
            <div className="flex flex-col gap-1">
              <span>{response.message}</span>
              {response.url && (
                <a href={response.url} target="_blank" rel="noopener noreferrer" className="text-sm underline text-primary hover:text-primary/80">
                  View Page
                </a>
              )}
            </div>
          ),
          duration: 7000,
        });
      } else {
        throw new Error(response.message || `Failed to create ${service} page.`);
      }
    } catch (error: any) {
      console.error(`Error integrating with ${service}:`, error);
      toast({
        title: `${service.charAt(0).toUpperCase() + service.slice(1)} Integration Failed`,
        description: error.message || `Could not create the ${service} page. Check console for details.`,
        variant: 'destructive',
      });
    } finally {
      setIntegrationLoading(null);
    }
  };

  const isAnythingLoading = isDownloading || isCopying || integrationLoading !== null;
  const shouldDisableActions = disabled || isAnythingLoading || (!transcript.trim() && !summary.trim());
  const integrationTitleIsMissing = !(pageTitle.trim() || fileNameBase.trim());
  const shouldDisableIntegration = shouldDisableActions || integrationTitleIsMissing;

  const handleCheckboxChange = (checked: boolean | string) => { // Updated for Checkbox onCheckedChange type
    const isChecked = !!checked; // Ensure boolean
    setCustomizeTxtFilename(isChecked);
    if (isChecked) {
      setTxtCustomName(pageTitle); 
    }
  };

  return (
    <Card className={cn(disabled && !isAnythingLoading && 'opacity-60')}>
      <CardHeader>
        <CardTitle>4. Export & Integrate</CardTitle>
        <CardDescription>Save your work locally or send it to other platforms.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         <div className="space-y-1.5">
            <Label htmlFor="page-title-input">Page Title (for Notion/Confluence & default for .txt)</Label>
            <Input
              id="page-title-input"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Enter title (e.g., Meeting Notes YYYY-MM-DD)"
              disabled={isAnythingLoading}
              aria-describedby="title-description-main"
            />
             <p id="title-description-main" className="text-xs text-muted-foreground">
                Used for Notion/Confluence page titles and as the default base for .txt filenames.
             </p>
         </div>

         <div className="flex items-center space-x-2">
            <Checkbox
              id="customize-txt-filename"
              checked={customizeTxtFilename}
              onCheckedChange={handleCheckboxChange}
              disabled={isAnythingLoading}
            />
            <Label
              htmlFor="customize-txt-filename"
              className="text-sm font-normal text-muted-foreground cursor-pointer"
            >
              Use a different filename for .txt export
            </Label>
          </div>

         {customizeTxtFilename && (
           <div className="space-y-1.5 pl-2">
             <Label htmlFor="txt-custom-name-input">Custom .txt Filename</Label>
             <Input
               id="txt-custom-name-input"
               value={txtCustomName}
               onChange={(e) => setTxtCustomName(e.target.value)}
               placeholder="Enter custom .txt filename..."
               disabled={isAnythingLoading}
               aria-describedby="title-description-txt"
             />
              <p id="title-description-txt" className="text-xs text-muted-foreground">
                 This name will be used specifically for the downloaded .txt file.
              </p>
           </div>
         )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            onClick={handleExportTxt}
            disabled={shouldDisableActions}
            variant="outline"
          >
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export as .txt
          </Button>
          <Button
            onClick={handleCopyToClipboard}
            disabled={shouldDisableActions}
            variant="outline"
          >
            {isCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Copy to Clipboard
          </Button>
          <Button
            onClick={() => handleIntegration('notion')}
            disabled={shouldDisableIntegration}
            variant="outline"
            aria-label="Send content to Notion"
          >
            {integrationLoading === 'notion' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send to Notion
          </Button>
          <Button
            onClick={() => handleIntegration('confluence')}
            disabled={shouldDisableIntegration}
            variant="outline"
            aria-label="Send content to Confluence"
          >
            {integrationLoading === 'confluence' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send to Confluence
          </Button>
        </div>
         {shouldDisableActions && !isAnythingLoading && (
             <p className="text-sm text-muted-foreground pt-2">Generate a transcript or summary to enable export/integration.</p>
         )}
      </CardContent>
    </Card>
  );
}
