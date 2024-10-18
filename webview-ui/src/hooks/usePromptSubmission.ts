import { useExtensionState } from "../context/ExtensionStateContext";
import { vscode } from "../utils/vscode";

export const usePromptSubmission = () => {
  const { isDebugMode } = useExtensionState();

  const handlePromptUse = (content: string, onUsePrompt: (content: string) => void) => {
    // Show the prompt in the chat area
    onUsePrompt(content);

    // If not in debug mode, automatically submit the prompt
    if (!isDebugMode) {
      submitPrompt(content);
    }
  };

  const submitPrompt = (content: string) => {
    // Implement the logic to automatically submit the prompt
    vscode.postMessage({ type: "newTask", text: content });
  };

  return { handlePromptUse, submitPrompt };
};
