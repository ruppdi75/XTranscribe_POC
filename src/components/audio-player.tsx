
'use client';

import type * as React from 'react';
import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/formatters';

interface AudioPlayerProps {
  src?: string | null; // Audio source URL
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

// Define the type for the imperative methods exposed via the ref
export interface AudioPlayerRef {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

// Use forwardRef to accept the ref from the parent
export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
  ({ src, onTimeUpdate, className }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Track loading state
    const [error, setError] = useState<string | null>(null); // Track errors


     // Reset state when src changes
     useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setIsLoading(!!src); // Set loading if src is provided
        setError(null); // Clear previous errors
        if (audioRef.current) {
            if (src) {
                audioRef.current.src = src;
                // Resetting the src might require a load() call on some browsers
                audioRef.current.load();
                // Attempt to play if it was playing before src change (might need user interaction)
                // if (isPlaying) {
                //   audioRef.current.play().catch(console.error);
                // }
            } else {
                // Clear the source if src is null/undefined
                audioRef.current.removeAttribute('src');
                audioRef.current.load(); // Important to unload the previous source
                audioRef.current.pause(); // Ensure it stops playing
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);


    const handlePlayPause = () => {
        if (!audioRef.current || !src) return;
        if (isPlaying) {
        audioRef.current.pause();
        } else {
            // Check if readyState is sufficient to play
            if (audioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or more
                audioRef.current.play().catch(err => {
                console.error("Audio Play Error:", err);
                setError("Failed to play audio. Please check the file or browser permissions.");
                setIsLoading(false);
                setIsPlaying(false); // Ensure state is correct on error
                });
            } else {
                // If not ready, set loading and try to load again
                setIsLoading(true);
                setError(null); // Clear previous errors while loading
                audioRef.current.load(); // Attempt to load
                // An event listener will handle playing once ready ('canplay' or 'canplaythrough')
            }
        }
    };

    const handleTimeUpdate = () => {
      if (!audioRef.current) return;
      const newTime = audioRef.current.currentTime;
      setCurrentTime(newTime);
      onTimeUpdate?.(newTime); // Call the callback prop
    };

    const handleLoadedMetadata = () => {
      if (!audioRef.current) return;
      setDuration(audioRef.current.duration);
      setIsLoading(false); // Metadata loaded, potentially ready to play soon
      setError(null); // Clear error on successful load
    };

    // Handle 'canplay' event to start playback if intended
    const handleCanPlay = () => {
      if (!audioRef.current) return;
      setIsLoading(false); // Ready to play
      setError(null); // Clear any loading errors
      if (isPlaying) { // If play was intended before loading finished
          audioRef.current.play().catch(err => {
          console.error("Audio Play Error on CanPlay:", err);
          setError("Failed to play audio automatically after loading.");
          setIsPlaying(false); // Update state if play failed
        });
      }
    };

    const handleSeek = (value: number[]) => {
      if (!audioRef.current) return;
      const newTime = value[0];
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    };

    const handleVolumeChange = (value: number[]) => {
      if (!audioRef.current) return;
      const newVolume = value[0];
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
      audioRef.current.muted = newVolume === 0;
    };

    const toggleMute = () => {
      if (!audioRef.current) return;
      const currentlyMuted = !isMuted;
      setIsMuted(currentlyMuted);
      audioRef.current.muted = currentlyMuted;
      // If unmuting and volume was 0, set to a default volume (e.g., 0.5)
      if (!currentlyMuted && volume === 0) {
        setVolume(0.5);
        audioRef.current.volume = 0.5;
      }
      // If muting, keep the volume slider position but set internal volume to 0 via 'muted'
    };

    const handleSkip = (amount: number) => {
      if (!audioRef.current || !duration) return;
      const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + amount));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      // Set time to the very end for slider visualization consistency
      setCurrentTime(duration || 0);
      // Optionally: move to the beginning? setCurrentTime(0);
    };

    // Public method to seek externally (e.g., from transcript click)
    const seekTo = useCallback((time: number) => {
      if (audioRef.current && duration > 0) {
        const validTime = Math.max(0, Math.min(duration, time));
        audioRef.current.currentTime = validTime;
        setCurrentTime(validTime);
        // Optionally, auto-play if seeking and not already playing
        if (!isPlaying && audioRef.current.paused) {
          handlePlayPause(); // Attempt to play
        }
      }
    }, [duration, isPlaying, handlePlayPause]); // Add handlePlayPause dependency

    const play = useCallback(() => {
        if (audioRef.current && !isPlaying) {
            handlePlayPause();
        }
    }, [isPlaying, handlePlayPause]);

    const pause = useCallback(() => {
        if (audioRef.current && isPlaying) {
            handlePlayPause();
        }
    }, [isPlaying, handlePlayPause]);


    // Expose seekTo, play, pause via ref
    useImperativeHandle(ref, () => ({
      seekTo,
      play,
      pause,
    }), [seekTo, play, pause]);

    // Error Handling
    const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      console.error("Audio Element Error:", audioRef.current?.error);
      let message = "An error occurred with the audio.";
      switch (audioRef.current?.error?.code) {
          case MediaError.MEDIA_ERR_ABORTED:
              message = 'Audio playback aborted.';
              break;
          case MediaError.MEDIA_ERR_NETWORK:
              message = 'A network error caused the audio download to fail.';
              break;
          case MediaError.MEDIA_ERR_DECODE:
              message = 'Audio playback failed due to decoding error.';
              break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              message = 'The audio format is not supported.';
              break;
          default:
              message = 'An unknown error occurred while loading or playing the audio.';
              break;
      }
      setError(message);
      setIsLoading(false);
      setIsPlaying(false);
    };


    return (
      <Card className={cn("w-full overflow-hidden", className)}>
        <CardContent className="p-4 space-y-3">
          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => { setIsPlaying(true); setIsLoading(false); setError(null); }}
            onPause={() => setIsPlaying(false)}
            onEnded={handleEnded}
            onWaiting={() => setIsLoading(true)} // Show loading when buffering
            onPlaying={() => setIsLoading(false)} // Hide loading when playback starts/resumes
            onCanPlay={handleCanPlay} // Handle readiness for playback
            onError={handleError} // Handle loading/playback errors
            preload="metadata" // Only load metadata initially
            className="hidden" // Hide the default player
            src={src || undefined} // Pass src directly here
          >
           Your browser does not support the audio element.
          </audio>

        {error && <p className="text-destructive text-sm text-center py-2">{error}</p>}

        {!src && !error && (
           <p className="text-muted-foreground text-sm text-center py-4">
             Upload or select a file to enable playback.
           </p>
         )}

        {src && (
          <>
            <div className="flex items-center gap-3">
              {/* Time Display (Current) */}
              <span className="text-xs font-mono text-muted-foreground w-12 text-right tabular-nums">
                {formatTime(currentTime)}
              </span>

              {/* Progress Slider */}
              <Slider
                value={[currentTime]}
                max={duration || 1} // Use 1 as max if duration is 0 to prevent errors
                step={0.1}
                onValueChange={handleSeek}
                disabled={!src || duration === 0 || isLoading}
                aria-label="Audio progress"
                className="flex-grow"
              />

              {/* Time Display (Duration) */}
              <span className="text-xs font-mono text-muted-foreground w-12 text-left tabular-nums">
                {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
                {/* Volume Control */}
              <div className="flex items-center gap-2 w-28">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    disabled={!src || isLoading}
                    className="h-8 w-8"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.05}
                  onValueChange={handleVolumeChange}
                  disabled={!src || isLoading}
                  aria-label="Volume control"
                  className="w-full"
                />
              </div>


              {/* Playback Controls */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSkip(-10)} // Rewind 10s
                disabled={!src || duration === 0 || isLoading}
                className="h-9 w-9"
                aria-label="Rewind 10 seconds"
              >
                <Rewind className="h-5 w-5" />
              </Button>
              <Button
                variant="default" // Make play/pause prominent
                size="icon"
                onClick={handlePlayPause}
                disabled={!src || (!duration && !isLoading)} // Disable if no src or if loading (unless duration is known)
                className="h-10 w-10 rounded-full"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                    <Pause className="h-5 w-5" />
                ) : (
                    <Play className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSkip(10)} // Fast Forward 10s
                disabled={!src || duration === 0 || isLoading}
                className="h-9 w-9"
                aria-label="Fast forward 10 seconds"
              >
                <FastForward className="h-5 w-5" />
              </Button>

                {/* Spacer to balance volume controls */}
              <div className="w-28" /> {/* Adjust width to match volume control width */}

            </div>
          </>
        )}
        </CardContent>
      </Card>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";

