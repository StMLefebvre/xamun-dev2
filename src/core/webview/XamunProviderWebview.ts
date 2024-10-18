import * as vscode from "vscode"
import { ExtensionMessage } from "../../shared/ExtensionMessage"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { getTheme } from "../../integrations/theme/getTheme"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"

export class XamunProviderWebview {
	constructor(private context: vscode.ExtensionContext) {}

	getHtmlContent(webview: vscode.Webview): string {
		const stylesUri = getUri(webview, this.context.extensionUri, [
			"webview-ui",
			"build",
			"static",
			"css",
			"main.css",
		])
		const scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "static", "js", "main.js"])
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		const nonce = getNonce()

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
            <title>Xamun Dev</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>
      `
	}

	setWebviewMessageListener(webview: vscode.Webview, messageHandler: (message: WebviewMessage) => Promise<void>) {
		webview.onDidReceiveMessage(messageHandler)
	}

	async postMessageToWebview(view: vscode.WebviewView | vscode.WebviewPanel, message: ExtensionMessage) {
		await view.webview.postMessage(message)
	}

	async updateTheme(view: vscode.WebviewView | vscode.WebviewPanel) {
		const theme = await getTheme()
		this.postMessageToWebview(view, { type: "theme", text: JSON.stringify(theme) })
	}
}
