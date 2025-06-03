
'use client';

import type * as React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // If needed for API keys etc.
import { Button } from '@/components/ui/button'; // If needed for saving settings
import { useToast } from '@/hooks/use-toast';

interface SettingsPanelProps {
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  // Add props for API keys or other settings if needed
  // notionApiKey?: string;
  // onNotionApiKeyChange?: (key: string) => void;
  // confluenceApiKey?: string;
  // onConfluenceApiKeyChange?: (key: string) => void;
  // onSaveSettings?: () => void;
}

export function SettingsPanel({
  fontSize,
  onFontSizeChange,
  // notionApiKey = '',
  // onNotionApiKeyChange,
  // confluenceApiKey = '',
  // onConfluenceApiKeyChange,
  // onSaveSettings
}: SettingsPanelProps) {
  const handleSliderChange = (value: number[]) => {
    onFontSizeChange(value[0]);
  };

  const { toast } = useToast();

  // Placeholder save function
  const handleSave = () => {
      // TODO: Implement actual saving logic (e.g., localStorage, backend)
      // onSaveSettings?.();
      toast({ title: 'Settings Saved', description: 'Your settings have been updated (simulated).' });
  };

  return (
    <Card className="w-full border-none shadow-none"> {/* Remove default card border/shadow inside Sheet */}
      <CardHeader className="px-1 pt-0 pb-4"> {/* Adjust padding */}
        {/* Title is already in SheetHeader, keep description if needed */}
        <CardDescription>Adjust application settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-1"> {/* Adjust padding and spacing */}
        {/* Display Settings */}
        <div className="space-y-2">
           <h3 className="text-md font-semibold text-foreground mb-3">Display</h3>
          <div className="grid gap-3">
            <Label htmlFor="font-size-slider">Transcript Font Size ({fontSize}px)</Label>
            <Slider
              id="font-size-slider"
              min={10}
              max={24}
              step={1}
              value={[fontSize]}
              onValueChange={handleSliderChange}
              aria-label={`Transcript Font Size: ${fontSize} pixels`}
            />
          </div>
        </div>

        {/* API Key Settings (Placeholder Example) */}
        {/*
        <div className="space-y-4">
           <h3 className="text-md font-semibold text-foreground mb-3">Integrations (Optional)</h3>
           <div className="grid gap-2">
             <Label htmlFor="notion-key">Notion API Key</Label>
             <Input
               id="notion-key"
               type="password" // Use password type for keys
               placeholder="Enter your Notion API key..."
               value={notionApiKey}
               onChange={(e) => onNotionApiKeyChange?.(e.target.value)}
               />
              <p className="text-xs text-muted-foreground">Required for Notion integration.</p>
           </div>
           <div className="grid gap-2">
             <Label htmlFor="confluence-key">Confluence API Token</Label>
             <Input
                id="confluence-key"
                type="password"
                placeholder="Enter your Confluence API token..."
                value={confluenceApiKey}
                onChange={(e) => onConfluenceApiKeyChange?.(e.target.value)}
               />
              <p className="text-xs text-muted-foreground">Required for Confluence integration.</p>
           </div>
        </div>
        */}

        {/* Save Button */}
        {/*
        <Button onClick={handleSave} className="w-full">
           Save Settings
        </Button>
        */}
      </CardContent>
    </Card>
  );
}
