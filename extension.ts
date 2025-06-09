import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface FileContent {
    path: string;
    content: string;
    language: string;
    lineRange?: {
        start: number;
        end: number;
    };
}

interface FolderNode {
    name: string;
    type: 'file' | 'folder';
    children?: FolderNode[];
    path: string;
}

export function activate(context: vscode.ExtensionContext) {
    const registerCommand = (command: string, callback: (...args: any[]) => any) => {
        const disposable = vscode.commands.registerCommand(command, async (...args) => {
            try {
                await callback(...args);
            } catch (error) {
                console.error(`Error in ${command}:`, error);
                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        context.subscriptions.push(disposable);
    };

    registerCommand('copyForContext.copySelectedFiles', handleCopySelectedFiles);
    registerCommand('copyForContext.copyActiveFile', handleCopyActiveFile);
    registerCommand('copyForContext.copyTabGroup', handleCopyTabGroup);
    registerCommand('copyForContext.copyAllTabs', handleCopyAllTabs);
    registerCommand('copyForContext.copySelectedTab', handleCopySelectedTab);
    registerCommand('copyForContext.copyFolderStructure', handleCopyFolderStructure);
    registerCommand('copyForContext.copyFolderWithFileStructure', handleCopyFolderWithFileStructure);
    registerCommand('copyForContext.copyLineRange', handleCopyLineRange);
    registerCommand('copyForContext.copySelectionWithLineNumbers', handleCopySelectionWithLineNumbers);
}

async function handleCopySelectedFiles(clickedFile: vscode.Uri, selectedFiles: vscode.Uri[]) {
    let filesToProcess: vscode.Uri[] = [];
    
    if (selectedFiles?.length > 0) {
        filesToProcess = selectedFiles;
    } else if (clickedFile) {
        filesToProcess = [clickedFile];
    } else {
        vscode.window.showWarningMessage('No files selected');
        return;
    }

    const validFiles: FileContent[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
        const batch = filesToProcess.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (fileUri) => {
            if (await isFile(fileUri) && !(await shouldIgnoreFile(fileUri))) {
                return await readFileContent(fileUri);
            }
            return null;
        }));
        
        for (const result of batchResults) {
            if (result) validFiles.push(result);
        }
    }

    if (validFiles.length === 0) {
        vscode.window.showWarningMessage('No valid files to copy');
        return;
    }

    const markdown = await generateMarkdown(validFiles);
    await copyToClipboard(markdown);
    vscode.window.showInformationMessage(`Copied ${validFiles.length} file(s) to clipboard`);
}

async function handleCopyFolderStructure(clickedFolder: vscode.Uri, selectedFolders: vscode.Uri[]) {
    try {
        let foldersToProcess: vscode.Uri[] = [];
        
        if (selectedFolders && selectedFolders.length > 0) {
            foldersToProcess = selectedFolders;
        } else if (clickedFolder) {
            foldersToProcess = [clickedFolder];
        } else {
            vscode.window.showWarningMessage('No folders selected');
            return;
        }

        const structures: FolderNode[] = [];
        
        for (const folderUri of foldersToProcess) {
            const structure = await buildFolderStructure(folderUri, false);
            if (structure) {
                structures.push(structure);
            }
        }

        if (structures.length === 0) {
            vscode.window.showWarningMessage('No valid folders to copy');
            return;
        }

        const markdown = generateFolderStructureMarkdown(structures);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied ${structures.length} folder structure(s) to clipboard`);
    } catch (error) {
        console.error('Error in handleCopyFolderStructure:', error);
        vscode.window.showErrorMessage(`Error copying folder structure: ${error}`);
    }
}

async function handleCopyFolderWithFileStructure(clickedFolder: vscode.Uri, selectedFolders: vscode.Uri[]) {
    try {
        let foldersToProcess: vscode.Uri[] = [];
        
        if (selectedFolders && selectedFolders.length > 0) {
            foldersToProcess = selectedFolders;
        } else if (clickedFolder) {
            foldersToProcess = [clickedFolder];
        } else {
            vscode.window.showWarningMessage('No folders selected');
            return;
        }

        const structures: FolderNode[] = [];
        
        for (const folderUri of foldersToProcess) {
            const structure = await buildFolderStructure(folderUri, true);
            if (structure) {
                structures.push(structure);
            }
        }

        if (structures.length === 0) {
            vscode.window.showWarningMessage('No valid folders to copy');
            return;
        }

        const markdown = generateFolderStructureMarkdown(structures);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied ${structures.length} folder structure(s) with file structure to clipboard`);
    } catch (error) {
        console.error('Error in handleCopyFolderWithFileStructure:', error);
        vscode.window.showErrorMessage(`Error copying folder structure with file structure: ${error}`);
    }
}

async function buildFolderStructure(folderUri: vscode.Uri, includeFiles: boolean): Promise<FolderNode | null> {
    try {
        const stat = await vscode.workspace.fs.stat(folderUri);
        if (stat.type !== vscode.FileType.Directory) {
            return null;
        }

        if (await shouldIgnoreFile(folderUri)) {
            return null;
        }

        const folderName = path.basename(folderUri.fsPath);
        const relativePath = getRelativePath(folderUri);
        
        const node: FolderNode = {
            name: folderName,
            type: 'folder',
            path: relativePath,
            children: []
        };

        const entries = await vscode.workspace.fs.readDirectory(folderUri);
        
        for (const [name, type] of entries) {
            const childUri = vscode.Uri.joinPath(folderUri, name);
            
            if (await shouldIgnoreFile(childUri)) {
                continue;
            }

            if (type === vscode.FileType.Directory) {
                const childNode = await buildFolderStructure(childUri, includeFiles);
                if (childNode) {
                    node.children!.push(childNode);
                }
            } else if (type === vscode.FileType.File && includeFiles) {
                const childRelativePath = getRelativePath(childUri);
                node.children!.push({
                    name,
                    type: 'file',
                    path: childRelativePath
                });
            }
        }

        // Sort children: folders first, then files, both alphabetically
        node.children!.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return node;
    } catch (error) {
        console.error(`Error building folder structure for ${folderUri.fsPath}:`, error);
        return null;
    }
}

function generateFolderStructureMarkdown(structures: FolderNode[]): string {
    const config = vscode.workspace.getConfiguration('copyForContext');
    const structureType = config.get<string>('folderStructureType', 'tree');
    let markdown = '# Folder Structure\n\n';
    
    structures.forEach((structure, index) => {
        if (index > 0) {
            markdown += '\n\n';
        }
        markdown += `## ${structure.path}\n`;
        if (structureType === 'json') {
            markdown += '```json\n';
            markdown += JSON.stringify(convertToJsonStructure(structure), null, 2);
            markdown += '\n```';
        } else {
            markdown += '```\n';
            markdown += renderFolderTree(structure, 0);
            markdown += '```';
        }
    });
    
    return markdown;
}

function convertToJsonStructure(node: FolderNode): any {
    if (node.type === 'file') {
        return 'File';
    }
    const result: any = {};
    if (node.children) {
        for (const child of node.children) {
            if (child.type === 'file') {
                result[child.name] = 'File';
            } else {
                result[child.name] = convertToJsonStructure(child);
            }
        }
    }
    return result;
}




function renderFolderTree(node: FolderNode, depth: number): string {
    const indent = '  '.repeat(depth);
    const prefix = node.type === 'folder' ? '📁 ' : '📄 ';
    let result = `${indent}${prefix}${node.name}\n`;
    
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            result += renderFolderTree(child, depth + 1);
        });
    }
    
    return result;
}

async function shouldIgnoreFile(uri: vscode.Uri): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('copyForContext');
    const respectGitignore = config.get<boolean>('respectGitignore', true);
    
    if (!respectGitignore) {
        return false;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return false;
    }

    try {
        const gitignorePath = path.join(workspaceFolder.uri.fsPath, '.gitignore');
        
        let gitignoreExists = false;
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(gitignorePath));
            gitignoreExists = true;
        } catch {
            gitignoreExists = false;
        }
        
        if (!gitignoreExists) {
            return false;
        }

        const gitignoreContent = await vscode.workspace.fs.readFile(vscode.Uri.file(gitignorePath));
        const gitignoreText = Buffer.from(gitignoreContent).toString('utf8');
        const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
        
        return isIgnoredByGitignore(relativePath, gitignoreText);
    } catch (error) {
        console.error('Error checking gitignore:', error);
        return false;
    }
}

function isIgnoredByGitignore(filePath: string, gitignoreContent: string): boolean {
    const lines = gitignoreContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    for (const pattern of lines) {
        if (matchesGitignorePattern(normalizedPath, pattern)) {
            return true;
        }
    }
    
    return false;
}

function matchesGitignorePattern(filePath: string, pattern: string): boolean {
    // Basic gitignore pattern matching
    // This is a simplified implementation - a full implementation would be more complex
    
    // Remove leading slash
    if (pattern.startsWith('/')) {
        pattern = pattern.substring(1);
    }
    
    // Handle directory patterns
    if (pattern.endsWith('/')) {
        pattern = pattern.substring(0, pattern.length - 1);
        // Check if any part of the path matches the directory pattern
        const pathParts = filePath.split('/');
        return pathParts.some(part => matchesSimplePattern(part, pattern));
    }
    
    // Handle wildcards
    if (pattern.includes('*')) {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        
        // Check if the full path or any part matches
        if (regex.test(filePath)) {
            return true;
        }
        
        // Check path segments
        const pathParts = filePath.split('/');
        return pathParts.some(part => regex.test(part));
    }
    
    // Exact match or path segment match
    if (filePath === pattern) {
        return true;
    }
    
    // Check if pattern matches any path segment
    const pathParts = filePath.split('/');
    return pathParts.includes(pattern);
}

function matchesSimplePattern(text: string, pattern: string): boolean {
    if (pattern.includes('*')) {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        return new RegExp(`^${regexPattern}$`).test(text);
    }
    return text === pattern;
}

// Keep all existing functions unchanged
async function handleCopyActiveFile() {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active file');
            return;
        }

        const fileContent = await readFileContent(activeEditor.document.uri);
        if (!fileContent) {
            vscode.window.showWarningMessage('Could not read active file');
            return;
        }

        const markdown = await generateMarkdown([fileContent]);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage('Copied active file to clipboard');
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying active file: ${error}`);
    }
}

async function handleCopyTabGroup() {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const tabGroup = vscode.window.tabGroups.activeTabGroup;
        const fileUris = tabGroup.tabs
            .map(tab => (tab.input as vscode.TabInputText)?.uri)
            .filter((uri): uri is vscode.Uri => uri !== undefined);

        if (fileUris.length === 0) {
            vscode.window.showWarningMessage('No files in current tab group');
            return;
        }

        const fileContents = await Promise.all(fileUris.map(uri => readFileContent(uri)));
        const validFiles = fileContents.filter((file): file is FileContent => file !== null);

        const markdown = await generateMarkdown(validFiles);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied ${validFiles.length} file(s) from tab group to clipboard`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying tab group: ${error}`);
    }
}

async function handleCopyAllTabs() {
    try {
        const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
        const fileUris = allTabs
            .map(tab => (tab.input as vscode.TabInputText)?.uri)
            .filter((uri): uri is vscode.Uri => uri !== undefined);

        if (fileUris.length === 0) {
            vscode.window.showWarningMessage('No open tabs');
            return;
        }

        const fileContents = await Promise.all(fileUris.map(uri => readFileContent(uri)));
        const validFiles = fileContents.filter((file): file is FileContent => file !== null);

        const markdown = await generateMarkdown(validFiles);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied ${validFiles.length} file(s) from all tabs to clipboard`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying all tabs: ${error}`);
    }
}

async function handleCopySelectedTab() {
    try {
        const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
        const fileUris = allTabs
            .map(tab => (tab.input as vscode.TabInputText)?.uri)
            .filter((uri): uri is vscode.Uri => uri !== undefined);

        if (fileUris.length === 0) {
            vscode.window.showWarningMessage('No open tabs');
            return;
        }

        const quickPickItems = fileUris.map(uri => {
            const relativePath = getRelativePath(uri);
            return {
                label: path.basename(uri.fsPath),
                description: relativePath,
                uri: uri,
                picked: false
            };
        });

        const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: 'Select files to copy for context (use Space to select multiple)'
        });

        if (!selectedItems || selectedItems.length === 0) {
            return;
        }

        const fileContents = await Promise.all(selectedItems.map(item => readFileContent(item.uri)));
        const validFiles = fileContents.filter((file): file is FileContent => file !== null);

        const markdown = await generateMarkdown(validFiles);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied ${validFiles.length} selected file(s) to clipboard`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying selected files: ${error}`);
    }
}

async function readFileContent(uri: vscode.Uri): Promise<FileContent | null> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();
        const language = getLanguageFromUri(uri);
        const relativePath = getRelativePath(uri);

        return {
            path: relativePath,
            content: content,
            language: language
        };
    } catch (error) {
        console.error(`Error reading file ${uri.fsPath}:`, error);
        return null;
    }
}

function getLanguageFromUri(uri: vscode.Uri): string {
    const ext = path.extname(uri.fsPath).toLowerCase();
    const languageMap: { [key: string]: string } = {
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'zsh',
        '.fish': 'fish',
        '.ps1': 'powershell',
        '.html': 'html',
        '.htm': 'html',
        '.xml': 'xml',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.toml': 'toml',
        '.ini': 'ini',
        '.cfg': 'ini',
        '.conf': 'conf',
        '.sql': 'sql',
        '.md': 'markdown',
        '.markdown': 'markdown',
        '.tex': 'latex',
        '.r': 'r',
        '.R': 'r',
        '.m': 'matlab',
        '.pl': 'perl',
        '.lua': 'lua',
        '.vim': 'vim',
        '.dockerfile': 'dockerfile',
        '.gitignore': 'gitignore',
        '.env': 'dotenv'
    };

    return languageMap[ext] || 'text';
}

function getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    let relativePath = workspaceFolder
        ? path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
        : path.basename(uri.fsPath);
        
    return relativePath.replace(/\\/g, '/');
}

async function generateMarkdown(files: FileContent[]): Promise<string> {
    let markdown = '';
    const config = vscode.workspace.getConfiguration('copyForContext');
    const globalMinify = config.get<boolean>('minifyContent', false);
    const selectionMinify = config.get<boolean>('selectionMinifyContent', false);
    const appendLineNumbers = config.get<boolean>('appendLineNumbers', true);

    files.forEach((file, index) => {
        // Determine if this file should be minified
        // If it's a line range selection, use the selection-specific setting
        // Otherwise, use the global setting
        const shouldMinify = file.lineRange ? selectionMinify : globalMinify;
        
        if (index > 0) {
            markdown += '\n';
        }
        
        // Append line range to file path if available and the setting is enabled
        let filePath = file.path;
        if (file.lineRange && appendLineNumbers) {
            filePath += `:${file.lineRange.start}${file.lineRange.start !== file.lineRange.end ? `-${file.lineRange.end}` : ''}`;
        }
        
        markdown += `## ${filePath}\n`;
        markdown += '```' + file.language + '\n';

        let content = file.content;
        if (shouldMinify) {
            content = minifyContent(content, file.language);
        }
        markdown += content;

        if (!content.endsWith('\n')) {
            markdown += '\n';
        }
        markdown += '```';
    });

    return markdown;
}

function minifyContent(content: string, language: string): string {
    const config = vscode.workspace.getConfiguration('copyForContext');
    const shouldRemoveComments = config.get<boolean>('removeComments', true);
    let minified = content;

    if (shouldRemoveComments) {
        minified = removeMultiLineComments(minified, language);
        minified = removeSingleLineComments(minified, language);
    }

    // Optimized minification: process in bulk instead of line-by-line
    minified = minified
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '')
        .join(' ');

    minified = applyLanguageSpecificMinification(minified, language);
    return minified.replace(/\s+/g, ' ').trim();
}

function removeMultiLineComments(content: string, language: string): string {
    if (['javascript', 'typescript', 'jsx', 'tsx', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala', 'css', 'scss', 'less'].includes(language)) {
        return content.replace(/\/\*[\s\S]*?\*\//g, '');
    }
    if (language === 'python') {
        return content.replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
    }
    if (['html', 'xml'].includes(language)) {
        return content.replace(/<!--[\s\S]*?-->/g, '');
    }
    return content;
}

function removeSingleLineComments(content: string, language: string): string {
    const lines = content.split('\n');
    const cleanLines: string[] = [];

    for (let line of lines) {
        if (['javascript', 'typescript', 'jsx', 'tsx', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala'].includes(language)) {
            line = removeCommentFromLine(line, '//', language);
        } else if (['python', 'ruby', 'bash', 'sh', 'yaml', 'toml'].includes(language)) {
            line = removeCommentFromLine(line, '#', language);
        } else if (['scss', 'sass'].includes(language)) {
            line = removeCommentFromLine(line, '//', language);
        }
        cleanLines.push(line);
    }

    return cleanLines.join('\n');
}

function removeCommentFromLine(line: string, commentChar: string, language: string): string {
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < line.length - (commentChar.length - 1); i++) {
        const char = line[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if ((char === '"' || char === "'" || char === '`') && !inString) {
            inString = true;
            stringChar = char;
            continue;
        }

        if (char === stringChar && inString) {
            inString = false;
            stringChar = '';
            continue;
        }

        if (!inString && line.substring(i, i + commentChar.length) === commentChar) {
            return line.substring(0, i).trim();
        }
    }

    return line;
}

function applyLanguageSpecificMinification(content: string, language: string): string {
    let result = content;

    if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
        result = result.replace(/\s*([+\-*/%=<>!&|^~,;:?()])\s*/g, '$1');
        result = result.replace(/\s*([{}])\s*/g, '$1');
        result = result.replace(/\s*([[\]])\s*/g, '$1');
        result = result.replace(/\b( if | else | for | while | do | switch | case | return | function | const | let | var | class | extends | implements | import | export | from | as | typeof | instanceof )\b/g, ' $1 ');
        result = result.replace(/\s+/g, ' ');
    } else if (['css', 'scss', 'less'].includes(language)) {
        result = result.replace(/\s*([{}:;,>+~])\s*/g, '$1');
        result = result.replace(/\s*([()])\s*/g, '$1');
        result = result.replace(/;}/g, '}');
    } else if (language === 'json') {
        result = result.replace(/\s*([{}[\]:,])\s*/g, '$1');
    } else if (language === 'python') {
        result = result.replace(/\s*([=+\-*/%<>!,()[\]{}:;])\s*/g, '$1');
        result = result.replace(/\b( if |elif| else | for | while |def| class | import | from | as | return |yield|try|except|finally|with|lambda|and|or|not|in|is)\b/g, ' $1 ');
        result = result.replace(/\s+/g, ' ');
    } else if (['java', 'c', 'cpp', 'csharp'].includes(language)) {
        result = result.replace(/\s*([+\-*/%=<>!&|^~,;:?(){}[\]])\s*/g, '$1');
        result = result.replace(/\b( if | else | for | while | do | switch | case | return | class |interface|public|private|protected|static|final|abstract| extends | implements | import |package|try|catch|finally|throw|throws|new|this|super|void|int|long|double|float|boolean|char|string)\b/g, ' $1 ');
        result = result.replace(/\s+/g, ' ');
    } else if (['html', 'xml'].includes(language)) {
        result = result.replace(/>\s+</g, '><');
        result = result.replace(/\s+/g, ' ');
    } else if (['yaml', 'yml'].includes(language)) {
        result = result.replace(/\s*:\s*/g, ':');
        result = result.replace(/\s*-\s*/g, '-');
    }

    return result.trim();
}

function isComment(line: string, language: string): boolean {
    const trimmed = line.trim();

    if (['javascript', 'typescript', 'jsx', 'tsx', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala'].includes(language)) {
        return trimmed.startsWith('//');
    }

    if (['python', 'ruby', 'bash', 'sh', 'yaml', 'toml'].includes(language)) {
        return trimmed.startsWith('#');
    }

    if (['css', 'scss', 'sass', 'less'].includes(language)) {
        return trimmed.startsWith('//');
    }

    return false;
}

async function copyToClipboard(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);
}

async function isFile(uri: vscode.Uri): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        return stat.type === vscode.FileType.File;
    } catch {
        return false;
    }
}

async function handleCopyLineRange() {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const selection = activeEditor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('No text selected');
            return;
        }

        // Get the start and end lines (1-based for display)
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;

        // Get the configuration
        const config = vscode.workspace.getConfiguration('copyForContext');
        const copyFullLines = config.get<boolean>('copyFullLines', false);

        let selectedText;
        if (copyFullLines) {
            // Get the full lines from start to end
            const startLineText = activeEditor.document.lineAt(selection.start.line).text;
            const endLineText = activeEditor.document.lineAt(selection.end.line).text;
            
            // If it's a single line selection
            if (startLine === endLine) {
                selectedText = startLineText;
            } else {
                // For multi-line selections, get all lines
                const range = new vscode.Range(
                    new vscode.Position(selection.start.line, 0),
                    new vscode.Position(selection.end.line, activeEditor.document.lineAt(selection.end.line).text.length)
                );
                selectedText = activeEditor.document.getText(range);
            }
        } else {
            // Get just the selected text
            selectedText = activeEditor.document.getText(selection);
        }

        if (!selectedText) {
            vscode.window.showWarningMessage('Selected text is empty');
            return;
        }

        // Create a FileContent object with the selected text and line range
        const fileContent = await readFileContentWithLineRange(
            activeEditor.document.uri,
            startLine,
            endLine,
            selectedText
        );

        if (!fileContent) {
            vscode.window.showWarningMessage('Could not read file content');
            return;
        }

        const markdown = await generateMarkdown([fileContent]);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied line range ${startLine}-${endLine} to clipboard`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying line range: ${error}`);
    }
}

async function handleCopySelectionWithLineNumbers() {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const selection = activeEditor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('No text selected');
            return;
        }

        // Get the start and end lines (0-based for processing)
        const startLine = selection.start.line;
        const endLine = selection.end.line;
        
        // Get the relative path of the file
        const relativePath = getRelativePath(activeEditor.document.uri);
        const language = getLanguageFromUri(activeEditor.document.uri);
        
        // Get configuration
        const config = vscode.workspace.getConfiguration('copyForContext');
        const shouldMinify = config.get<boolean>('selectionMinifyContent', false);
        
        // Build the content with line numbers
        let content = '';
        
        if (shouldMinify) {
            // For minified content, collect all lines first
            let linesWithNumbers = [];
            for (let i = startLine; i <= endLine; i++) {
                const lineNumber = i + 1; // Convert to 1-based for display
                const lineText = activeEditor.document.lineAt(i).text.trim();
                if (lineText) { // Skip empty lines when minifying
                    linesWithNumbers.push(`${lineNumber}: ${lineText}`);
                }
            }
            
            // Join all lines with numbers into a single line
            content = linesWithNumbers.join(' ');
        } else {
            // For regular content, keep line breaks
            for (let i = startLine; i <= endLine; i++) {
                const lineNumber = i + 1; // Convert to 1-based for display
                const lineText = activeEditor.document.lineAt(i).text;
                content += `${lineNumber}: ${lineText}\n`;
            }
        }
        
        if (!content) {
            vscode.window.showWarningMessage('Selected text is empty');
            return;
        }
        
        // Create file path with line range
        let filePath = `## ${relativePath}:${startLine + 1}`;
        if (startLine !== endLine) {
            filePath += `-${endLine + 1}`;
        }
        
        // Create markdown with file path and line numbers
        let markdown = `${filePath}\n\`\`\`${language}\n${content}`;

        if (!content.endsWith('\n')) {
            markdown += '\n';
        }
        markdown += '```';
        
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied selection with line numbers to clipboard`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying selection with line numbers: ${error}`);
    }
}

async function readFileContentWithLineRange(
    uri: vscode.Uri,
    startLine: number,
    endLine: number,
    selectedText: string
): Promise<FileContent | null> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const language = getLanguageFromUri(uri);
        const relativePath = getRelativePath(uri);
        
        // Create a FileContent object with the selected text and line range
        return {
            path: relativePath,
            content: selectedText,
            language: language,
            lineRange: {
                start: startLine,
                end: endLine
            }
        };
    } catch (error) {
        console.error(`Error reading file ${uri.fsPath}:`, error);
        return null;
    }
}

export function deactivate() {
    // Clean up any resources if needed
}