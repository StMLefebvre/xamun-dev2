import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export namespace xamun {
  /**
   * Shows a temporary message in the status bar aligned to the right corner.
   * @param message The message to display.
   * @param duration Duration in milliseconds to show the message.
   */
  export function showTimedMessage(message: string, duration: number = 5000) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = message;
    statusBarItem.show();

    setTimeout(() => {
      statusBarItem.hide(); // Hide after the duration
      statusBarItem.dispose(); // Dispose to free resources
    }, duration);
  }

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

  /**
   * Gets a file from the ai folder.
   * @param fileName The name of the file to get.
   * @returns The full path to the file in the ai folder.
   */
  export function getAiFile(fileName: string): string {
    const aiFolder = path.join(__dirname, "ai");
    console.log('AI Folder:', aiFolder);
    return path.join(aiFolder, fileName);
  }

  /**
   * Reads and parses the promptLib.json file from the ai folder.
   * @returns The parsed content of the promptLib.json file or null if an error occurs.
   */
  export function readPromptLib(): any {
    try {
      const promptLibPath = getAiFile('promptLib.json');
      console.log('Prompt Library Path:', promptLibPath);
      
      if (!fs.existsSync(promptLibPath)) {
        console.error('promptLib.json does not exist at path:', promptLibPath);
        return null;
      }

      const fileContent = fs.readFileSync(promptLibPath, 'utf8');
      console.log('File Content:', fileContent);

      const parsedContent = JSON.parse(fileContent);
      console.log('Parsed Content:', parsedContent);

      return parsedContent;
    } catch (error) {
      console.error('Error reading promptLib.json:', error);
      return null;
    }
  }
}
