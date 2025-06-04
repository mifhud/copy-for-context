# Copy for Context

A VS Code extension that efficiently copies selected files as markdown with syntax highlighting and minimized content—perfect for sharing code context in documentation, issues, or chat applications.

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

## Usage

### From Explorer
1. Select one or more files in the VS Code Explorer
2. Right-click on the selection
3. Choose **"Copy for Context"**
4. The formatted markdown is now in your clipboard

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

## Installation

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