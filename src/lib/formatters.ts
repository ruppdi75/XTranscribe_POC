

/**
 * Formats a time duration given in seconds into a MM:SS string format.
 * Handles NaN, negative inputs, and very large numbers gracefully.
 *
 * @param seconds - The total number of seconds. Can be float or integer.
 * @returns A string representing the time in MM:SS format (e.g., "01:35"). Returns "00:00" for invalid inputs.
 */
export function formatTime(seconds: number): string {
  // Handle invalid inputs
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  // Use padStart for consistent two-digit formatting
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');

  return `${formattedMinutes}:${formattedSeconds}`;
}


/**
 * Formats bytes into a human-readable string (e.g., KB, MB, GB).
 *
 * @param bytes - The number of bytes.
 * @param decimals - The number of decimal places to include (default is 2).
 * @returns A formatted string representing the file size.
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes < 0 || isNaN(bytes) || !isFinite(bytes)) return '0 Bytes'; // Handle invalid input
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Ensure index is within bounds
    const unitIndex = Math.min(i, sizes.length - 1);

    return parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm)) + ' ' + sizes[unitIndex];
}
