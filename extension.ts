import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface FileContent {
    path: string;
    content: string;
    language: string;
}

export function activate(context: vscode.ExtensionContext) {
    // Register all commands
    const copySelectedFiles = vscode.commands.registerCommand('copyForContext.copySelectedFiles', async (clickedFile: vscode.Uri, selectedFiles: vscode.Uri[]) => {
        await handleCopySelectedFiles(clickedFile, selectedFiles);
    });

    const copyActiveFile = vscode.commands.registerCommand('copyForContext.copyActiveFile', async () => {
        await handleCopyActiveFile();
    });

    const copyTabGroup = vscode.commands.registerCommand('copyForContext.copyTabGroup', async () => {
        await handleCopyTabGroup();
    });

    const copyAllTabs = vscode.commands.registerCommand('copyForContext.copyAllTabs', async () => {
        await handleCopyAllTabs();
    });

    const copySelectedTab = vscode.commands.registerCommand('copyForContext.copySelectedTab', async () => {
        await handleCopySelectedTab();
    });

    context.subscriptions.push(
        copySelectedFiles,
        copyActiveFile,
        copyTabGroup,
        copyAllTabs,
        copySelectedTab
    );
}

async function handleCopySelectedFiles(clickedFile: vscode.Uri, selectedFiles: vscode.Uri[]) {
    try {
        // When files are selected in Explorer, VS Code passes:
        // - clickedFile: the file that was right-clicked
        // - selectedFiles: array of all selected files (including the clicked file)
        
        let filesToProcess: vscode.Uri[] = [];
        
        if (selectedFiles && selectedFiles.length > 0) {
            // Multiple files selected - use all selected files
            filesToProcess = selectedFiles;
        } else if (clickedFile) {
            // Only one file clicked - use just that file
            filesToProcess = [clickedFile];
        } else {
            vscode.window.showWarningMessage('No files selected');
            return;
        }

        console.log(`Processing ${filesToProcess.length} files:`, filesToProcess.map(f => f.fsPath));

        const fileContents = await Promise.all(
            filesToProcess.map(async (fileUri) => {
                if (await isFile(fileUri)) {
                    return await readFileContent(fileUri);
                }
                return null;
            })
        );

        const validFiles = fileContents.filter((file): file is FileContent => file !== null);
        if (validFiles.length === 0) {
            vscode.window.showWarningMessage('No valid files to copy');
            return;
        }

        const markdown = await generateMarkdown(validFiles);
        await copyToClipboard(markdown);
        vscode.window.showInformationMessage(`Copied ${validFiles.length} file(s) to clipboard`);
    } catch (error) {
        console.error('Error in handleCopySelectedFiles:', error);
        vscode.window.showErrorMessage(`Error copying files: ${error}`);
    }
}

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

        const fileContents = await Promise.all(
            fileUris.map(uri => readFileContent(uri))
        );

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

        const fileContents = await Promise.all(
            fileUris.map(uri => readFileContent(uri))
        );

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
        // In VS Code, there isn't a direct concept of "multiple selected tabs"
        // So we'll implement this as a multi-step selection process
        
        // Get all open tabs across all tab groups
        const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
        const fileUris = allTabs
            .map(tab => (tab.input as vscode.TabInputText)?.uri)
            .filter((uri): uri is vscode.Uri => uri !== undefined);

        if (fileUris.length === 0) {
            vscode.window.showWarningMessage('No open tabs');
            return;
        }

        // Create quick pick items with file names and paths
        const quickPickItems = fileUris.map(uri => {
            const relativePath = getRelativePath(uri);
            return {
                label: path.basename(uri.fsPath),
                description: relativePath,
                uri: uri,
                picked: false
            };
        });

        // Show multi-select quick pick
        const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: 'Select files to copy for context (use Space to select multiple)'
        });

        if (!selectedItems || selectedItems.length === 0) {
            return; // User cancelled or selected nothing
        }

        // Read content of selected files
        const fileContents = await Promise.all(
            selectedItems.map(item => readFileContent(item.uri))
        );

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
    let relativePath: string;
    
    if (workspaceFolder) {
        relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    } else {
        relativePath = path.basename(uri.fsPath);
    }
    
    // Convert backslashes to forward slashes for consistency
    return relativePath.replace(/\\/g, '/');
}

async function generateMarkdown(files: FileContent[]): Promise<string> {
    let markdown = '';
    
    // Get configuration settings
    const config = vscode.workspace.getConfiguration('copyForContext');
    const shouldMinify = config.get<boolean>('minifyContent', false);

    files.forEach((file, index) => {
        if (index > 0) {
            markdown += shouldMinify ? '\n' : '\n\n';
        }

        markdown += `## ${file.path}\n${shouldMinify ? '' : '\n'}`;
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
    // Get configuration settings
    const config = vscode.workspace.getConfiguration('copyForContext');
    const shouldRemoveComments = config.get<boolean>('removeComments', true);
    
    let minified = content;
    
    // Remove comments only if the setting is enabled
    if (shouldRemoveComments) {
        // Remove multi-line comments first
        minified = removeMultiLineComments(minified, language);
        
        // Remove single-line comments
        minified = removeSingleLineComments(minified, language);
    }
    
    // Split into lines and process
    const lines = minified.split('\n');
    const processedLines: string[] = [];
    
    for (let line of lines) {
        line = line.trim();
        
        // Skip empty lines
        if (line === '') {
            continue;
        }
        
        processedLines.push(line);
    }
    
    // Join all lines and apply language-specific minification
    let result = processedLines.join(' ');
    
    // Apply language-specific minification rules
    result = applyLanguageSpecificMinification(result, language);
    
    // Final cleanup - remove excessive spaces
    result = result.replace(/\s+/g, ' ').trim();
    
    return result;
}

function removeMultiLineComments(content: string, language: string): string {
    // JavaScript/TypeScript/Java/C/C++/C# style /* */ comments
    if (['javascript', 'typescript', 'jsx', 'tsx', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala', 'css', 'scss', 'less'].includes(language)) {
        return content.replace(/\/\*[\s\S]*?\*\//g, '');
    }
    
    // Python triple quotes (docstrings)
    if (language === 'python') {
        return content.replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
    }
    
    // HTML/XML comments
    if (['html', 'xml'].includes(language)) {
        return content.replace(/<!--[\s\S]*?-->/g, '');
    }
    
    return content;
}

function removeSingleLineComments(content: string, language: string): string {
    const lines = content.split('\n');
    const cleanLines: string[] = [];
    
    for (let line of lines) {
        // JavaScript/TypeScript/Java/C/C++/C# style // comments
        if (['javascript', 'typescript', 'jsx', 'tsx', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala'].includes(language)) {
            // Handle string literals to avoid removing // inside strings
            line = removeCommentFromLine(line, '//', language);
        }
        
        // Python/Ruby/Shell style # comments
        else if (['python', 'ruby', 'bash', 'sh', 'yaml', 'toml'].includes(language)) {
            line = removeCommentFromLine(line, '#', language);
        }
        
        // CSS/SCSS single-line comments
        else if (['scss', 'sass'].includes(language)) {
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
        
        // Handle string literals
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
        
        // Check for comment start
        if (!inString && line.substring(i, i + commentChar.length) === commentChar) {
            return line.substring(0, i).trim();
        }
    }
    
    return line;
}

function applyLanguageSpecificMinification(content: string, language: string): string {
    let result = content;
    
    // JavaScript/TypeScript specific minification
    if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
        // Remove spaces around operators (but be careful with edge cases)
        result = result.replace(/\s*([+\-*/%=<>!&|^~,;:?()])\s*/g, '$1');
        // Remove spaces around curly braces
        result = result.replace(/\s*([{}])\s*/g, '$1');
        // Remove spaces around square brackets
        result = result.replace(/\s*([[\]])\s*/g, '$1');
        // Add back necessary spaces for keywords
        result = result.replace(/\b(if|else|for|while|do|switch|case|return|function|const|let|var|class|extends|implements|import|export|from|as|typeof|instanceof)\b/g, ' $1 ');
        result = result.replace(/\s+/g, ' ');
    }
    
    // CSS specific minification
    else if (['css', 'scss', 'less'].includes(language)) {
        // Remove spaces around CSS syntax
        result = result.replace(/\s*([{}:;,>+~])\s*/g, '$1');
        // Remove spaces around parentheses
        result = result.replace(/\s*([()])\s*/g, '$1');
        // Remove trailing semicolons before }
        result = result.replace(/;}/g, '}');
    }
    
    // JSON specific minification
    else if (language === 'json') {
        result = result.replace(/\s*([{}[\]:,])\s*/g, '$1');
    }
    
    // Python specific minification (be more careful due to indentation significance)
    else if (language === 'python') {
        // Only remove extra spaces, keep structure
        result = result.replace(/\s*([=+\-*/%<>!,()[\]{}:;])\s*/g, '$1');
        // Add back necessary spaces for keywords
        result = result.replace(/\b(if|elif|else|for|while|def|class|import|from|as|return|yield|try|except|finally|with|lambda|and|or|not|in|is)\b/g, ' $1 ');
        result = result.replace(/\s+/g, ' ');
    }
    
    // Java/C/C++/C# specific minification
    else if (['java', 'c', 'cpp', 'csharp'].includes(language)) {
        result = result.replace(/\s*([+\-*/%=<>!&|^~,;:?(){}[\]])\s*/g, '$1');
        // Add back necessary spaces for keywords
        result = result.replace(/\b(if|else|for|while|do|switch|case|return|class|interface|public|private|protected|static|final|abstract|extends|implements|import|package|try|catch|finally|throw|throws|new|this|super|void|int|long|double|float|boolean|char|string)\b/g, ' $1 ');
        result = result.replace(/\s+/g, ' ');
    }
    
    // HTML/XML minification
    else if (['html', 'xml'].includes(language)) {
        // Remove spaces between tags
        result = result.replace(/>\s+</g, '><');
        // Remove extra whitespace within tags
        result = result.replace(/\s+/g, ' ');
    }
    
    // YAML/JSON formatting (preserve some structure)
    else if (['yaml', 'yml'].includes(language)) {
        // Keep minimal formatting for readability
        result = result.replace(/\s*:\s*/g, ':');
        result = result.replace(/\s*-\s*/g, '-');
    }
    
    return result.trim();
}

function isComment(line: string, language: string): boolean {
    // This function is now mainly used as a fallback
    // Most comment removal is handled by the dedicated functions above
    const trimmed = line.trim();
    
    // JavaScript/TypeScript/Java/C/C++/C# style comments
    if (['javascript', 'typescript', 'jsx', 'tsx', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala'].includes(language)) {
        return trimmed.startsWith('//');
    }
    
    // Python/Ruby/Shell style comments
    if (['python', 'ruby', 'bash', 'sh', 'yaml', 'toml'].includes(language)) {
        return trimmed.startsWith('#');
    }
    
    // CSS comments
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

export function deactivate() {}