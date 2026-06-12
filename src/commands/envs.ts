import * as vscode from 'vscode';
import { Provider } from '../provider/envs';
import * as envs from '../genv/envs';
import * as env from '../genv/env';
import * as terminal from '../genv/terminal';
import * as envCommands from './env';

let provider: Provider;

/**
 * Initializes the environments view of the extension.
 */
export function init(context: vscode.ExtensionContext) {
    provider = new Provider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('genv.envs', provider));
	context.subscriptions.push(vscode.commands.registerCommand('genv.envs.refresh', refresh));
	context.subscriptions.push(vscode.commands.registerCommand('genv.envs.activateExisting', activateExisting));
	context.subscriptions.push(vscode.commands.registerCommand('genv.envs.deactivate', deactivate));
}

/**
 * Refreshes the environments view.
 */
function refresh() {
    provider.refresh();
}

export async function activateExisting(treeItem?: vscode.TreeItem) {
    let selectedEid: string | undefined;

    if (env.activated()) {
         vscode.window.showWarningMessage('Already running in an activated GPU environment');
         return;
     }

    if (treeItem && treeItem.label) {
        const label = treeItem.label as string;
        const match = label.match(/^([^\s(]+)/);
        if (match) {
            selectedEid = match[1];
        }
    }

    if (!selectedEid) {
        const list = await envs.ps();
        const picks = list.map(e => ({ label: e.name ? `${e.eid} (${e.name})` : `${e.eid}`, description: e.user, eid: e.eid }));

        const pick = await vscode.window.showQuickPick(picks as any, { placeHolder: 'Select environment to join' });
        if (!pick) {
            return;
        }
        selectedEid = (pick as any).eid;
    }

    if (selectedEid) {
        try {
            await env.joinExisting(selectedEid);
        } catch (err: any) {
            vscode.window.showErrorMessage(`${err}`);
            return;
        }

        await env.configName(`vscode/${vscode.workspace.name}`);

        vscode.window.terminals.forEach(terminal.activate);

        envCommands.showStatus();

        vscode.commands.executeCommand('genv.envs.refresh');
        vscode.commands.executeCommand('genv.devices.refresh');
        vscode.commands.executeCommand('setContext', 'genv.env.activated', true);
        refresh();        
    }
}

export async function deactivate() {
    if (env.activated()) {
        try {
            await env.detach();
            vscode.window.terminals.forEach(terminal.deactivate);
            await env.deactivate();
        } catch (err: any) {
            vscode.window.showErrorMessage(`${err}`);
            return;
        }

        envCommands.showStatus();

        vscode.commands.executeCommand('genv.envs.refresh');
        vscode.commands.executeCommand('genv.devices.refresh');
        vscode.commands.executeCommand('setContext', 'genv.env.activated', false);
        refresh();
    } else {
        vscode.window.showWarningMessage('No active environment to deactivate');
    }
}
