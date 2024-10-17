export namespace xamun {
  /**
   * Converts a Windows-style relative path to a Linux-style path.
   * @param path The Windows path to convert.
   * @returns The converted Linux-style path.
   */
  export function windowsToLinuxPath(path: string): string {
    let linuxPath = path.replace(/\\/g, '/'); // Replace backslashes with forward slashes

    // If the path starts with a drive letter, convert it to /mnt/drive
    const driveLetterMatch = linuxPath.match(/^([a-zA-Z]):\//);
    if (driveLetterMatch) {
      const driveLetter = driveLetterMatch[1].toLowerCase();
      linuxPath = `/mnt/${driveLetter}${linuxPath.slice(2)}`;
    }

    return linuxPath;
  }
}
