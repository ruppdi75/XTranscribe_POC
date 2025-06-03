
'use client';

import type * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  segments: TranscriptSegment[];
  fontSize: number;
  onSegmentClick?: (startTime: number) => void;
  className?: string;
  style?: React.CSSProperties;
  currentTime?: number;
  fullTranscriptPlaceholder?: string; // New prop for placeholder text
}

export function TranscriptEditor({
  className,
  fontSize,
  style,
  segments,
  onSegmentClick,
  currentTime,
  fullTranscriptPlaceholder, // Destructure new prop
  ...props
}: TranscriptEditorProps) {
  const dynamicStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: `${fontSize * 1.6}px`,
    ...style,
  };

  const handleSegmentClick = (startTime: number) => {
    onSegmentClick?.(startTime);
  };

   const isSegmentActive = (segment: TranscriptSegment): boolean => {
    if (currentTime === undefined || currentTime === null) return false;
    return currentTime >= segment.start && currentTime <= segment.end + 0.1;
  };


  return (
    <ScrollArea className={cn('h-[250px] sm:h-[300px] lg:h-[350px] w-full rounded-md border bg-secondary/30', className)}>
      <div
        className="p-4 whitespace-pre-wrap font-mono focus:outline-none selection:bg-primary/30"
        style={dynamicStyle}
        {...props}
        aria-live="polite"
      >
        {segments.length === 0 ? (
          <span className="text-muted-foreground italic">
            {fullTranscriptPlaceholder || 'Transcript will appear here once the file is processed...'}
          </span>
        ) : (
          segments.map((segment, index) => (
            <span
              key={`${segment.start}-${index}`}
              data-start={segment.start}
              data-end={segment.end}
              onClick={() => handleSegmentClick(segment.start)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                      handleSegmentClick(segment.start);
                  }
              }}
              className={cn(
                'cursor-pointer transition-colors duration-150 hover:bg-primary/15 rounded mx-[1px] px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-primary/10',
                 isSegmentActive(segment) ? 'bg-primary/20 text-primary-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.5)]' : 'hover:bg-primary/10'
              )}
               aria-label={`Transcript segment from ${segment.start.toFixed(1)}s to ${segment.end.toFixed(1)}s. Click to seek audio.`}
            >
              {segment.text}
            </span>
          )).reduce((prev: (React.ReactNode | string)[], curr: React.ReactNode, index: number) => {
              if (index > 0) {
                  prev.push(' ');
              }
              prev.push(curr);
              return prev;
          }, [])
        )}
      </div>
    </ScrollArea>
  );
}

    