
'use client';

import type * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { UploadCloud, File as FileIcon, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatters';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  supportedFormats?: string[];
  maxSize?: number; // in bytes
  currentFile?: File | null;
  onRemoveFile?: () => void;
  disabled?: boolean; // Added disabled prop
}

export function FileUpload({
  onFileSelect,
  supportedFormats = ['audio/*', 'video/*'],
  maxSize = 1024 * 1024 * 1024, // Default to 1GB
  currentFile = null,
  onRemoveFile,
  disabled = false, // Default disabled to false
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
      // If currentFile (from parent) changes and it's different from the file being "uploaded",
      // or if currentFile is cleared, reset the internal upload simulation state.
      if (currentFile !== uploadingFile) {
          setUploadingFile(null);
          setUploadProgress(null);
      }
  }, [currentFile, uploadingFile]);

  // Reset internal state if component becomes disabled externally
  useEffect(() => {
    if (disabled) {
      setUploadingFile(null);
      setUploadProgress(null);
      setDragging(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear file input if it was somehow populated
      }
    }
  }, [disabled]);

  const validateFile = useCallback((file: File): boolean => {
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: `"${file.name}" (${formatBytes(file.size)}) exceeds the current client-side limit of ${formatBytes(maxSize)}. Very large files may still fail during AI processing.`,
        variant: 'destructive',
        duration: 7000,
      });
      return false;
    }

    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const fileMimeType = file.type;

    const isSupported = supportedFormats.some(format => {
      if (format.startsWith('.')) {
        return fileExtension === format.toLowerCase();
      }
      if (format.endsWith('/*')) {
        return fileMimeType.startsWith(format.slice(0, -1));
      }
      return fileMimeType === format;
    });

    if (!isSupported) {
       const friendlyFormats = supportedFormats
            .map(f => f.startsWith('.') ? f.toUpperCase() : f.split('/')[0].toUpperCase())
            .filter((value, index, self) => self.indexOf(value) === index)
            .join(', ');
       toast({
        title: 'Unsupported File Type',
        description: `"${file.name}" (${fileExtension.toUpperCase()} / ${fileMimeType || 'unknown'}) is not supported. Please use: ${friendlyFormats}.`,
        variant: 'destructive',
       });
       return false;
    }
    return true;
  }, [maxSize, supportedFormats, toast]);

  const startUploadSimulation = useCallback((file: File) => {
      if (disabled || uploadProgress !== null) return; // Don't start if disabled or already uploading

      setUploadingFile(file);
      setUploadProgress(0);
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5; // Simulate variable progress steps
        progress = Math.min(progress, 100);
        setUploadProgress(progress);

        if (progress >= 100) {
          clearInterval(interval);
          onFileSelect(file); // Call the parent callback *after* simulation completes
          // Keep progress bar at 100% for a short moment for visual feedback then clear.
          setTimeout(() => {
              // Only clear if this is still the active uploading file.
              // This handles potential race conditions if another file is selected very quickly
              // or if the component becomes disabled.
              setUploadingFile(prevFile => {
                if (prevFile === file) {
                    setUploadProgress(null); // Clear progress only if it's still this file
                    return null;
                }
                return prevFile;
              });
          }, 500); // Delay before clearing progress bar
        }
      }, 150); // Interval for progress update
  }, [onFileSelect, disabled, uploadProgress]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || uploadProgress !== null) return;
    const file = event.target.files?.[0];
    if (file && validateFile(file)) {
      startUploadSimulation(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input to allow selecting the same file again
    }
  }, [validateFile, startUploadSimulation, disabled, uploadProgress]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || uploadProgress !== null) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
        startUploadSimulation(file);
    }
  }, [validateFile, startUploadSimulation, disabled, uploadProgress]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || uploadProgress !== null) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types && event.dataTransfer.types.includes('Files')) {
        setDragging(true);
    }
  }, [disabled, uploadProgress]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || uploadProgress !== null) return;
    // Check if drag is leaving to an internal element or outside the drop zone
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
        return;
    }
    setDragging(false);
  }, [disabled, uploadProgress]);

  const triggerFileInput = () => {
    if (disabled || uploadProgress !== null) return;
    fileInputRef.current?.click();
  };

   const handleRemoveFile = () => {
    if (disabled) return; // Should not be possible if remove button is also disabled, but good check
    setUploadingFile(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemoveFile?.(); // This will notify parent, which should update currentFile
  };

  const isUploading = uploadProgress !== null && uploadingFile !== null;
  const displayFile = !isUploading && currentFile && !disabled;

  const friendlyMaxSize = formatBytes(maxSize);

  return (
    <div className={cn("space-y-3", disabled && !isUploading && "opacity-50 cursor-not-allowed")}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={supportedFormats.join(',')}
        aria-label="File upload input"
        disabled={disabled || isUploading}
      />
      <Button onClick={triggerFileInput} className="w-full" disabled={disabled || isUploading}>
        {isUploading ? (
           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
           <UploadCloud className="mr-2 h-4 w-4" />
        )}
        {isUploading ? `Uploading ${uploadingFile?.name}...` : (currentFile && !disabled ? 'Select Different File...' : 'Select File...')}
      </Button>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={triggerFileInput}
        className={cn(
          'flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md transition-colors',
          'text-muted-foreground',
          (disabled || isUploading)
              ? 'cursor-not-allowed bg-secondary/30 border-input' // Visually indicate disabled state
              : 'cursor-pointer hover:border-primary hover:text-primary',
          dragging && !(disabled || isUploading) ? 'border-primary bg-primary/10 text-primary' : 'border-input'
        )}
        role="button"
        tabIndex={(disabled || isUploading) ? -1 : 0}
        aria-label={(disabled || isUploading) ? 'File upload disabled or in progress' : 'Drag and drop file upload area or click to select file'}
        aria-disabled={disabled || isUploading}
      >
        <UploadCloud className={cn("h-8 w-8 mb-2", dragging && !(disabled || isUploading) && "text-primary")} />
        <span>{dragging && !(disabled || isUploading) ? 'Drop the file here...' : '...or drag & drop file here'}</span>
        <span className="text-xs mt-1 text-center">
            Max {friendlyMaxSize}. Formats: {supportedFormats.map(f => f.startsWith('.') ? f.toUpperCase().substring(1) : f.split('/')[0].toUpperCase()).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
        </span>
      </div>

      {isUploading && uploadingFile && (
        <div className="mt-3 space-y-1 p-3 border rounded-md bg-secondary/50">
             <div className="flex items-center gap-2 text-sm mb-1">
                 <FileIcon className="h-5 w-5 text-primary shrink-0" />
                 <span className="truncate font-medium">{uploadingFile.name}</span>
                 <span className="text-muted-foreground ml-1 shrink-0">({formatBytes(uploadingFile.size)})</span>
             </div>
            <Progress value={uploadProgress} className="h-2 w-full" />
            <p className="text-xs text-muted-foreground text-center">{Math.round(uploadProgress ?? 0)}% uploaded</p>
        </div>
       )}
       
      {displayFile && ( // Show current file only if not uploading and component is not disabled
        <div className="mt-3 p-3 border rounded-md bg-secondary/50 flex items-center justify-between text-sm">
           <div className="flex items-center gap-2 truncate min-w-0">
             <FileIcon className="h-5 w-5 text-primary shrink-0" />
             <span className="truncate font-medium">{currentFile.name}</span>
             <span className="text-muted-foreground ml-1 shrink-0">({formatBytes(currentFile.size)})</span>
           </div>
           {onRemoveFile && ( // The remove button should be available if a file is selected and we're not mid-upload.
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleRemoveFile} 
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" 
                    aria-label="Remove selected file" 
                    disabled={disabled || isUploading} // Disable if globally disabled or uploading
                >
                    <X className="h-4 w-4" />
                </Button>
           )}
        </div>
      )}
       
       {maxSize > 200 * 1024 * 1024 && ( // Keep this warning if applicable
        <div className="mt-2 p-2 border border-amber-500/50 bg-amber-500/10 rounded-md text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
                The file size limit is set to {friendlyMaxSize}. 
                Please note that AI models have their own processing limits, and very large files might lead to errors or long processing times regardless of this client-side setting.
            </span>
        </div>
       )}
    </div>
  );
}
