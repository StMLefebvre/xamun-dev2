import { useCallback, useEffect, useState } from "react"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../src/shared/ExtensionMessage"
import ChatView from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeView"
import PromptLibraryView from "./components/promptlibrary/PromptLibraryView"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import { vscode } from "./utils/vscode"

const AppContent = () => {
	const { didHydrateState, showWelcome, shouldShowAnnouncement } = useExtensionState()
	const [showSettings, setShowSettings] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [showPromptLibrary, setShowPromptLibrary] = useState(false)
	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>(undefined)
	const [promptContent, setPromptContent] = useState<string | undefined>(undefined)

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "action":
				switch (message.action!) {
					case "settingsButtonClicked":
						setShowSettings(true)
						setShowHistory(false)
						setShowPromptLibrary(false)
						break
					case "historyButtonClicked":
						setShowSettings(false)
						setShowHistory(true)
						setShowPromptLibrary(false)
						break
					case "promptLibraryButtonClicked":
						setShowSettings(false)
						setShowHistory(false)
						setShowPromptLibrary(true)
						setSelectedFilePath(message.context?.filePath)
						break
					case "chatButtonClicked":
						setShowSettings(false)
						setShowHistory(false)
						setShowPromptLibrary(false)
						break
				}
				break
		}
	}, [])

	useEvent("message", handleMessage)

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement])

	const handleUsePrompt = useCallback((content: string) => {
		setPromptContent(content)
		setShowPromptLibrary(false)
		setShowSettings(false)
		setShowHistory(false)
	}, [])

	if (!didHydrateState) {
		return null
	}

	return (
		<div style={{ padding: '0px', minHeight: '100vh', boxSizing: 'border-box' }}>
			
			{showWelcome ? (
				<WelcomeView />
			) : (
				<>
					{showSettings && <SettingsView onDone={() => setShowSettings(false)} />}
					{showHistory && <HistoryView onDone={() => setShowHistory(false)} />}
					{showPromptLibrary && (
						<PromptLibraryView
							onDone={() => setShowPromptLibrary(false)}
							onUsePrompt={handleUsePrompt}
							selectedFilePath={selectedFilePath}
						/>
					)}
					{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
					<ChatView
						showHistoryView={() => {
							setShowSettings(false)
							setShowHistory(true)
							setShowPromptLibrary(false)
						}}
						isHidden={showSettings || showHistory || showPromptLibrary}
						showAnnouncement={showAnnouncement}
						hideAnnouncement={() => {
							setShowAnnouncement(false)
						}}
						promptContent={promptContent}
						setPromptContent={setPromptContent}
					/>
				</>
			)}
		</div>
	)
}

const App = () => {
	return (
		<ExtensionStateContextProvider>
			<AppContent />
		</ExtensionStateContextProvider>
	)
}

export default App
