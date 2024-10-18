import { Anthropic } from "@anthropic-ai/sdk"
import axios from "axios"
import fs from "fs/promises"
import pWaitFor from "p-wait-for"
import * as path from "path"
import * as vscode from "vscode"
import { buildApiHandler } from "../../api"
import { downloadTask } from "../../integrations/misc/export-markdown"
import { openFile, openImage } from "../../integrations/misc/open-file"
import { selectImages } from "../../integrations/misc/process-images"
import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker"
import { ModelInfo } from "../../shared/api"
import { ExtensionMessage } from "../../shared/ExtensionMessage"
import { HistoryItem } from "../../shared/HistoryItem"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { fileExistsAtPath } from "../../utils/fs"
import { Cline } from "../Cline"
import { openMention } from "../mentions"
import { XamunProviderState } from "./XamunProviderState"
import { XamunProviderWebview } from "./XamunProviderWebview"

export const GlobalFileNames = {
	apiConversationHistory: "api_conversation_history.json",
	uiMessages: "ui_messages.json",
	openRouterModels: "openrouter_models.json",
}

export class XamunProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "xamun-dev.SidebarProvider"
	public static readonly tabPanelId = "xamun-dev.TabPanelProvider"
	private static activeInstances: Set<XamunProvider> = new Set()
	private disposables: vscode.Disposable[] = []
	private view?: vscode.WebviewView | vscode.WebviewPanel
	private cline?: Cline
	private workspaceTracker?: WorkspaceTracker
	private latestAnnouncementId = "oct-9-2024"
	private state: XamunProviderState
	private webview: XamunProviderWebview

	constructor(readonly context: vscode.ExtensionContext, private readonly outputChannel: vscode.OutputChannel) {
		this.outputChannel.appendLine("XamunProvider instantiated")
		XamunProvider.activeInstances.add(this)
		this.workspaceTracker = new WorkspaceTracker(this)
		this.state = new XamunProviderState(context)
		this.webview = new XamunProviderWebview(context)
	}

	async dispose() {
		this.outputChannel.appendLine("Disposing XamunProvider...")
		await this.clearTask()
		this.outputChannel.appendLine("Cleared task")
		if (this.view && "dispose" in this.view) {
			this.view.dispose()
			this.outputChannel.appendLine("Disposed webview")
		}
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		this.workspaceTracker?.dispose()
		this.workspaceTracker = undefined
		this.outputChannel.appendLine("Disposed all disposables")
		XamunProvider.activeInstances.delete(this)
	}

	public static getVisibleInstance(): XamunProvider | undefined {
		return Array.from(this.activeInstances).find((instance) => instance.view?.visible === true)
	}

	resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): void | Thenable<void> {
		this.outputChannel.appendLine("Resolving webview view")
		this.view = webviewView

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}
		webviewView.webview.html = this.webview.getHtmlContent(webviewView.webview)

		this.webview.setWebviewMessageListener(webviewView.webview, this.handleWebviewMessage.bind(this))

		if ("onDidChangeViewState" in webviewView) {
			webviewView.onDidChangeViewState(
				() => {
					if (this.view?.visible) {
						this.webview.postMessageToWebview(this.view, { type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				this.disposables
			)
		} else if ("onDidChangeVisibility" in webviewView) {
			webviewView.onDidChangeVisibility(
				() => {
					if (this.view?.visible) {
						this.webview.postMessageToWebview(this.view, { type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				this.disposables
			)
		}

		webviewView.onDidDispose(
			async () => {
				await this.dispose()
			},
			null,
			this.disposables
		)

		vscode.workspace.onDidChangeConfiguration(
			async (e) => {
				if (e && e.affectsConfiguration("workbench.colorTheme")) {
					await this.webview.updateTheme(webviewView)
				}
			},
			null,
			this.disposables
		)

		this.clearTask()

		this.outputChannel.appendLine("Webview view resolved")
	}

	async initClineWithTask(task?: string, images?: string[]) {
		await this.clearTask()
		const { apiConfiguration, customInstructions, alwaysAllowReadOnly } = await this.state.getState()
		this.cline = new Cline(this, apiConfiguration, customInstructions, alwaysAllowReadOnly, task, images)
	}

	async initClineWithHistoryItem(historyItem: HistoryItem) {
		await this.clearTask()
		const { apiConfiguration, customInstructions, alwaysAllowReadOnly } = await this.state.getState()
		this.cline = new Cline(
			this,
			apiConfiguration,
			customInstructions,
			alwaysAllowReadOnly,
			undefined,
			undefined,
			historyItem
		)
	}

	async postMessageToWebview(message: ExtensionMessage) {
		if (this.view) {
			await this.webview.postMessageToWebview(this.view, message)
		}
	}

	private async handleWebviewMessage(message: WebviewMessage) {
		switch (message.type) {
			case "webviewDidLaunch":
				this.postStateToWebview()
				this.workspaceTracker?.initializeFilePaths()
				this.webview.updateTheme(this.view!)
				this.readOpenRouterModels().then((openRouterModels) => {
					if (openRouterModels) {
						this.postMessageToWebview({ type: "openRouterModels", openRouterModels })
					} else {
						this.refreshOpenRouterModels()
					}
				})
				break
			case "newTask":
				await this.initClineWithTask(message.text, message.images)
				break
			case "apiConfiguration":
				if (message.apiConfiguration) {
					for (const [key, value] of Object.entries(message.apiConfiguration)) {
						if (key.toLowerCase().includes("key") || key.toLowerCase().includes("token")) {
							await this.state.storeSecret(key as any, value as string)
						} else {
							await this.state.updateGlobalState(key as any, value)
						}
					}
					if (this.cline) {
						this.cline.api = buildApiHandler(message.apiConfiguration)
					}
				}
				await this.postStateToWebview()
				break
			case "customInstructions":
				await this.updateCustomInstructions(message.text)
				break
			case "alwaysAllowReadOnly":
				await this.state.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
				if (this.cline) {
					this.cline.alwaysAllowReadOnly = message.bool ?? false
				}
				await this.postStateToWebview()
				break
			case "setIsDebugMode":
				await this.state.updateGlobalState("isDebugMode", message.value)
				await this.postStateToWebview()
				break
			case "askResponse":
				this.cline?.handleWebviewAskResponse(message.askResponse!, message.text, message.images)
				break
			case "clearTask":
				await this.clearTask()
				await this.postStateToWebview()
				break
			case "didShowAnnouncement":
				await this.state.updateGlobalState("lastShownAnnouncementId", this.latestAnnouncementId)
				await this.postStateToWebview()
				break
			case "selectImages":
				const images = await selectImages()
				await this.postMessageToWebview({ type: "selectedImages", images })
				break
			case "exportCurrentTask":
				const currentTaskId = this.cline?.taskId
				if (currentTaskId) {
					this.exportTaskWithId(currentTaskId)
				}
				break
			case "showTaskWithId":
				this.showTaskWithId(message.text!)
				break
			case "deleteTaskWithId":
				this.deleteTaskWithId(message.text!)
				break
			case "exportTaskWithId":
				this.exportTaskWithId(message.text!)
				break
			case "resetState":
				await this.resetState()
				break
			case "requestOllamaModels":
				const ollamaModels = await this.getOllamaModels(message.text)
				this.postMessageToWebview({ type: "ollamaModels", ollamaModels })
				break
			case "refreshOpenRouterModels":
				await this.refreshOpenRouterModels()
				break
			case "openImage":
				openImage(message.text!)
				break
			case "openFile":
				openFile(message.text!)
				break
			case "openMention":
				openMention(message.text)
				break
			case "cancelTask":
				if (this.cline) {
					const { historyItem } = await this.getTaskWithId(this.cline.taskId)
					this.cline.abortTask()
					await pWaitFor(() => this.cline === undefined || this.cline.didFinishAborting, {
						timeout: 3_000,
					}).catch(() => {
						console.error("Failed to abort task")
					})
					await this.initClineWithHistoryItem(historyItem)
				}
				break
		}
	}

	async updateCustomInstructions(instructions?: string) {
		await this.state.updateGlobalState("customInstructions", instructions || undefined)
		if (this.cline) {
			this.cline.customInstructions = instructions || undefined
		}
		await this.postStateToWebview()
	}

	async getOllamaModels(baseUrl?: string) {
		try {
			if (!baseUrl) {
				baseUrl = "http://localhost:11434"
			}
			if (!URL.canParse(baseUrl)) {
				return []
			}
			const response = await axios.get(`${baseUrl}/api/tags`)
			const modelsArray = response.data?.models?.map((model: any) => model.name) || []
			const models = [...new Set<string>(modelsArray)]
			return models
		} catch (error) {
			return []
		}
	}

	async handleOpenRouterCallback(code: string) {
		let apiKey: string
		try {
			const response = await axios.post("https://openrouter.ai/api/v1/auth/keys", { code })
			if (response.data && response.data.key) {
				apiKey = response.data.key
			} else {
				throw new Error("Invalid response from OpenRouter API")
			}
		} catch (error) {
			console.error("Error exchanging code for API key:", error)
			throw error
		}

		await this.state.updateGlobalState("apiProvider", "openrouter")
		await this.state.storeSecret("openRouterApiKey", apiKey)
		await this.postStateToWebview()
		if (this.cline) {
			this.cline.api = buildApiHandler({ apiProvider: "openrouter", openRouterApiKey: apiKey })
		}
	}

	private async ensureCacheDirectoryExists(): Promise<string> {
		const cacheDir = path.join(this.context.globalStorageUri.fsPath, "cache")
		await fs.mkdir(cacheDir, { recursive: true })
		return cacheDir
	}

	async readOpenRouterModels(): Promise<Record<string, ModelInfo> | undefined> {
		const openRouterModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			GlobalFileNames.openRouterModels
		)
		const fileExists = await fileExistsAtPath(openRouterModelsFilePath)
		if (fileExists) {
			const fileContents = await fs.readFile(openRouterModelsFilePath, "utf8")
			return JSON.parse(fileContents)
		}
		return undefined
	}

	async refreshOpenRouterModels() {
		const openRouterModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			GlobalFileNames.openRouterModels
		)

		let models: Record<string, ModelInfo> = {}
		try {
			const response = await axios.get("https://openrouter.ai/api/v1/models")
			if (response.data?.data) {
				const rawModels = response.data.data
				const parsePrice = (price: any) => {
					if (price) {
						return parseFloat(price) * 1_000_000
					}
					return undefined
				}
				for (const rawModel of rawModels) {
					const modelInfo: ModelInfo = {
						maxTokens: rawModel.top_provider?.max_completion_tokens,
						contextWindow: rawModel.context_length,
						supportsImages: rawModel.architecture?.modality?.includes("image"),
						supportsPromptCache: false,
						inputPrice: parsePrice(rawModel.pricing?.prompt),
						outputPrice: parsePrice(rawModel.pricing?.completion),
						description: rawModel.description,
					}

					switch (rawModel.id) {
						case "anthropic/claude-3.5-sonnet":
						case "anthropic/claude-3.5-sonnet:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 3.75
							modelInfo.cacheReadsPrice = 0.3
							break
						case "anthropic/claude-3-opus":
						case "anthropic/claude-3-opus:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 18.75
							modelInfo.cacheReadsPrice = 1.5
							break
						case "anthropic/claude-3-haiku":
						case "anthropic/claude-3-haiku:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 0.3
							modelInfo.cacheReadsPrice = 0.03
							break
					}

					models[rawModel.id] = modelInfo
				}
			} else {
				console.error("Invalid response from OpenRouter API")
			}
			await fs.writeFile(openRouterModelsFilePath, JSON.stringify(models))
			console.log("OpenRouter models fetched and saved", models)
		} catch (error) {
			console.error("Error fetching OpenRouter models:", error)
		}

		await this.postMessageToWebview({ type: "openRouterModels", openRouterModels: models })
	}

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		uiMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = ((await this.state.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const historyItem = history.find((item) => item.id === id)
		if (historyItem) {
			const taskDirPath = path.join(this.context.globalStorageUri.fsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory)
			const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages)
			const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					uiMessagesFilePath,
					apiConversationHistory,
				}
			}
		}
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	async showTaskWithId(id: string) {
		if (id !== this.cline?.taskId) {
			const { historyItem } = await this.getTaskWithId(id)
			await this.initClineWithHistoryItem(historyItem)
		}
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	async deleteTaskWithId(id: string) {
		if (id === this.cline?.taskId) {
			await this.clearTask()
		}

		const { taskDirPath, apiConversationHistoryFilePath, uiMessagesFilePath } = await this.getTaskWithId(id)

		await this.deleteTaskFromState(id)

		const apiConversationHistoryFileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
		if (apiConversationHistoryFileExists) {
			await fs.unlink(apiConversationHistoryFilePath)
		}
		const uiMessagesFileExists = await fileExistsAtPath(uiMessagesFilePath)
		if (uiMessagesFileExists) {
			await fs.unlink(uiMessagesFilePath)
		}
		const legacyMessagesFilePath = path.join(taskDirPath, "claude_messages.json")
		if (await fileExistsAtPath(legacyMessagesFilePath)) {
			await fs.unlink(legacyMessagesFilePath)
		}
		await fs.rmdir(taskDirPath)
	}

	async deleteTaskFromState(id: string) {
		const taskHistory = ((await this.state.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.state.updateGlobalState("taskHistory", updatedTaskHistory)

		await this.postStateToWebview()
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview()
		this.postMessageToWebview({ type: "state", state })
	}

	async getStateToPostToWebview() {
		const { apiConfiguration, lastShownAnnouncementId, customInstructions, alwaysAllowReadOnly, taskHistory, isDebugMode } =
			await this.state.getState()
		return {
			version: this.context.extension?.packageJSON?.version ?? "",
			apiConfiguration,
			customInstructions,
			alwaysAllowReadOnly,
			uriScheme: vscode.env.uriScheme,
			clineMessages: this.cline?.clineMessages || [],
			taskHistory: (taskHistory || []).filter((item) => item.ts && item.task).sort((a, b) => b.ts - a.ts),
			shouldShowAnnouncement: lastShownAnnouncementId !== this.latestAnnouncementId,
			isDebugMode,
		}
	}

	async clearTask() {
		this.cline?.abortTask()
		this.cline = undefined
	}

	async resetState() {
		await this.state.resetState()
		if (this.cline) {
			this.cline.abortTask()
			this.cline = undefined
		}
		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	async updateTaskHistory(historyItem: HistoryItem) {
		const taskHistory = ((await this.state.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const existingItemIndex = taskHistory.findIndex((item) => item.id === historyItem.id)
		
		if (existingItemIndex !== -1) {
			// Update existing item
			taskHistory[existingItemIndex] = historyItem
		} else {
			// Add new item
			taskHistory.push(historyItem)
		}
		
		await this.state.updateGlobalState("taskHistory", taskHistory)
		await this.postStateToWebview()
	}
}
