# Copy for Context

A VS Code extension that efficiently copies selected files as markdown with syntax highlighting and minimized content—perfect for sharing code context in chat applications.

## Features

### 🗂️ Copy for Context (Explorer)
- Select multiple files in the VS Code Explorer
- Right-click and choose **"Copy for Context"**
- Copies selected files as formatted markdown with syntax highlighting
- Includes relative file paths as headers

### 📄 Copy This File for Context
- Right-click any tab title or use Command Palette
- Copies the active file as markdown with proper syntax highlighting
- Perfect for sharing individual file contents

### 📂 Copy This Tab Group for Context
- Right-click any tab title or use Command Palette
- Copies all files in the current tab group as formatted markdown
- Great for sharing related files together

### 📋 Copy All Open Tabs for Context
- Use Command Palette or right-click any tab title
- Copies contents of all open tabs as markdown
- Useful for sharing your entire working context

### 🎯 Copy Selected File for Context
- Right-click any tab title or use Command Palette
- Alternative way to copy the currently selected tab file as markdown

### 🏗️ Copy Folder Structure Only
- Right-click on any folder in the Explorer
- Copies the directory tree structure without file contents
- Perfect for sharing project organization
- Shows folders (📁) and files (📄) with proper indentation

### 📁 Copy Folder Structure with File Structure
- Right-click on any folder in the Explorer
- Copies both the directory structure and all file contents
- Ideal for sharing complete project context
- Combines folder tree visualization with actual code

### 🚫 Gitignore Support (NEW)
- Automatically respects `.gitignore` rules when copying folders
- Excludes files and directories listed in `.gitignore`
- Can be toggled on/off in settings
- Works with all folder-related copy operations

## Usage

### From Explorer

#### Files
1. Select one or more files in the VS Code Explorer
2. Right-click on the selection
3. Choose **"Copy for Context"**
4. The formatted markdown is now in your clipboard

#### Folders
1. Right-click on any folder in the VS Code Explorer
2. Choose one of the folder options:
   - **"Copy Folder Structure Only"** - Gets directory tree without file contents
   - **"Copy Folder Structure with File Structure"** - Gets directory tree plus all file contents
3. The formatted markdown is now in your clipboard

### From Tab Context Menu
1. Right-click on any tab title
2. Choose one of the copy options:
   - **Copy This File for Context**
   - **Copy This Tab Group for Context**
   - **Copy All Open Tabs for Context**
   - **Copy Selected File for Context**

### From Command Palette
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Copy" to see all available copy commands
3. Select the desired option

## Output Format

### File Contents
The extension generates clean markdown with:
- File paths as level 2 headers (`## path/to/file.js`)
- Code blocks with automatic language detection
- Proper syntax highlighting identifiers

Example output:
```markdown
## src/components/Button.tsx
```tsx
import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ onClick, children }) => {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
};
```

## src/styles/button.css
```css
.button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```
```

### Folder Structure Only
Example output:
```markdown
# Folder Structure

## src

```
📁 src
  📁 components
  📁 styles
```
```

### Folder Structure with File Structure
Example output:
```markdown
## Folder Structure

# src

```
📁 src
  📁 components
    📄 Button.tsx
    📄 Header.tsx
  📁 styles
    📄 button.css
    📄 header.css
  📄 index.ts
```

## Files

## src/components/Button.tsx
```tsx
import React from 'react';
// ... file content
```

## src/components/Header.tsx
```tsx
import React from 'react';
// ... file content
```

## src/styles/button.css
```css
.button {
  padding: 8px 16px;
  // ... file content
}
```
```

## Supported Languages

The extension automatically detects and applies syntax highlighting for 40+ languages including:

- JavaScript/TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`)
- Python (`.py`)
- Java (`.java`)
- C/C++ (`.c`, `.cpp`, `.h`, `.hpp`)
- C# (`.cs`)
- PHP (`.php`)
- Ruby (`.rb`)
- Go (`.go`)
- Rust (`.rs`)
- Swift (`.swift`)
- Kotlin (`.kt`)
- HTML/XML (`.html`, `.xml`)
- CSS/SCSS/SASS (`.css`, `.scss`, `.sass`)
- JSON/YAML (`.json`, `.yaml`, `.yml`)
- Shell scripts (`.sh`, `.bash`)
- And many more...

## Configuration

Add these settings to your `settings.json`:

```json
{
  "copyForContext.minifyContent": false,
  "copyForContext.removeComments": true,
  "copyForContext.respectGitignore": true
}
```

### Available Settings

- **`copyForContext.minifyContent`** (boolean, default: `false`)
  - When enabled, fully minifies code by removing all comments, unnecessary whitespace, and newlines - similar to JavaScript minification

- **`copyForContext.removeComments`** (boolean, default: `true`)
  - When minification is enabled, controls whether comments are removed from the code. Only applies when `minifyContent` is true.

- **`copyForContext.respectGitignore`** (boolean, default: `true`)
  - When enabled, files and folders listed in `.gitignore` will be excluded from the copy process. Applies to all folder-related operations.

## Gitignore Support

The extension includes intelligent `.gitignore` support:

- **Automatic Detection**: Looks for `.gitignore` in your workspace root
- **Pattern Matching**: Supports common gitignore patterns including:
  - Exact file/folder names (`node_modules`)
  - Wildcards (`*.log`, `temp*`)
  - Directory patterns (`dist/`, `build/`)
  - Path-based patterns (`src/temp/`)
- **Configurable**: Can be disabled via settings if needed
- **Folder Operations**: Only affects folder-related copy operations

### Gitignore Examples

If your `.gitignore` contains:
```
node_modules/
*.log
dist
.env
temp*
```

The extension will automatically exclude:
- The entire `node_modules` folder
- Any `.log` files
- The `dist` folder
- `.env` files
- Any files/folders starting with `temp`

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Copy for Context"
4. Click Install

### Development Setup
1. Clone this repository
2. Run `npm install` to install dependencies
3. Open in VS Code
4. Press `F5` to launch Extension Development Host
5. Test the extension in the new VS Code window

### Building
1. Run `npm run compile` to build the extension
2. Use `vsce package` to create a `.vsix` file for installation

## Requirements

- VS Code version 1.74.0 or higher

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this extension in your projects.