# Welcome to MarkHu

A powerful, browser-based Markdown editor with seamless GitHub integration for syncing and managing your documentation directly from your browser.

## Features

✨ **Rich Markdown Editing**
- Live WYSIWYG preview with synchronized scrolling
- GitHub Flavored Markdown (GFM) support
- Real-time preview with multiple view modes

📐 **Advanced Math Support**
- KaTeX-powered inline and block mathematical formulas
- Syntax: `$inline formula$` and `$$block formula$$`
- Seamless rendering alongside standard Markdown

🔗 **GitHub Integration**
- Direct synchronization with your GitHub repositories
- Browse and edit files from any of your repos
- Commit changes directly back to GitHub
- Support for subdirectories and nested file browsing
- Manual repository entry for non-owned repos

🎨 **Smart UI**
- GitHub-inspired dark theme
- Multiple view modes:
  - **Split View**: Editor on left, live preview on right
  - **Edit Mode**: Full-width editor
  - **Preview Mode**: Full-width preview
- Responsive sidebar with repository explorer
- Keyboard shortcuts for quick formatting
- Toast notifications for user feedback

💾 **Local & Cloud Storage**
- Auto-save drafts to browser localStorage
- Persistent GitHub authentication tokens (localStorage)
- Hidden repository management
- Support for `.md`, `.txt`, and `.mdx` files

🛠️ **Formatting Toolbar**
Quick-insert buttons for:
- Text styles (bold, italic, strikethrough)
- Headings (H1, H2, H3)
- Links and images
- Code blocks and inline code
- Lists (unordered)
- Blockquotes
- Tables
- Mathematical formulas
- Checkboxes

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A GitHub Personal Access Token (for GitHub sync features)

### Usage

1. **Open the editor**: Simply open `main.html` in your web browser
2. **Connect GitHub (optional)**:
   - Click "Connect Account" in the sidebar
   - Enter your GitHub Personal Access Token (classic) with `repo` scope
   - Your repositories will load automatically

3. **Start editing**:
   - Write or paste Markdown in the editor
   - See live preview in real-time
   - Use the toolbar for quick formatting

4. **GitHub Sync**:
   - Click on a repository in the sidebar
   - Browse and select files to edit
   - Make changes in the editor
   - Click "Save to GitHub" to commit changes

## Creating a GitHub Personal Access Token

To enable GitHub synchronization:

1. Go to GitHub Settings → Developer settings → [Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Set the scope to `repo` (Full control of private repositories)
4. Copy the token and paste it into MarkHub

⚠️ **Security Note**: Keep your token private. It's stored in your browser's localStorage and never sent to external servers (only to GitHub's official API).

## Technology Stack

- **Frontend Framework**: React 18.2.0 (via ESM)
- **Markdown Parser**: [Marked.js](https://marked.js.org/)
- **Math Rendering**: [KaTeX](https://katex.org/)
- **CSS Framework**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **API Integration**: GitHub REST API v3
- **JavaScript**: Vanilla JavaScript with Babel for JSX compilation

All dependencies are loaded from CDNs for instant, zero-setup usage.

## Supported Markdown Syntax

### Basic Formatting
```markdown
**bold text**
*italic text*
~~strikethrough~~
```

### Headings
```markdown
# Heading 1
## Heading 2
### Heading 3
```

### Code & Math
```markdown
`inline code`

```javascript
code block
```

$P_{g,i} - P_{d,i} = \sum_{j=1}^{N} |V_i||V_j||Y_{ij}| \cos(\theta_i - \theta_j - \delta_{ij})$

$$E = mc^2$$
```

### Links & Images
```markdown
[Link text](https://example.com)
![Alt text](image-url.jpg)
```

### Lists & Blockquotes
```markdown
- List item 1
- List item 2

> Blockquote text
```

### Tables
```markdown
| Column 1 | Column 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

## Keyboard Shortcuts

Here is a list of keyboard shortcuts to enhance your editing workflow:

### File Operations
*   **Save/Commit**: `Ctrl/Cmd + S`
*   **Export to PDF**: `Ctrl/Cmd + P`

### Text Formatting
*   **Bold**: `Ctrl/Cmd + B`
*   **Italic**: `Ctrl/Cmd + I`
*   **Strikethrough**: `Ctrl/Cmd + Shift + S`
*   **Link**: `Ctrl/Cmd + K`
*   **Image**: `Ctrl/Cmd + Alt + I`

### Structural Elements
*   **Unordered List**: `Ctrl/Cmd + Shift + U`
*   **Numbered List**: `Ctrl/Cmd + Shift + O`
*   **Task List**: `Ctrl/Cmd + Shift + L`
*   **Blockquote**: `Ctrl/Cmd + Shift + Q`
*   **Code Block**: `Ctrl/Cmd + Alt + C`
*   **Inline Code**: `Ctrl/Cmd + Alt + \``
*   **Table**: `Ctrl/Cmd + Alt + T`
*   **Math Block**: `Ctrl/Cmd + Alt + M`

### View and UI
*   **Toggle Sidebar**: `Ctrl/Cmd + Alt + O`
*   **Toggle Theme (Light/Dark)**: `Ctrl/Cmd + Alt + D`
*   **Toggle Editor Only View**: `Ctrl/Cmd + Shift + 1`
*   **Toggle Split View**: `Ctrl/Cmd + Shift + 2`
*   **Toggle Preview Only View**: `Ctrl/Cmd + Shift + 3`

## Project Structure

```
GitMarkdownEditor/
├── main.html          # Single-file React application
├── README.md          # This file
└── LICENSE            # MIT License
```

## File Details

### main.html
The complete application bundled into a single HTML file containing:
- HTML structure
- Tailwind CSS styling
- React application code
- External dependency imports via CDN

The file is self-contained and requires no build process or dependencies to be installed.

## Browser Compatibility

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Local Storage

MarkHub stores the following in your browser's localStorage for persistence:

- `markhub_draft`: Current editor content
- `gh_token`: GitHub Personal Access Token (if connected)
- `markhub_hidden_repos`: List of hidden repositories

⚠️ **Privacy Warning**: Store sensitive data carefully. Your GitHub token is stored locally in plain text.

## Known Limitations

- Math rendering requires internet connection for KaTeX CDN
- File uploads to GitHub are limited to changes in existing files (no new file creation via UI)
- Only `.md`, `.txt`, and `.mdx` files are supported for GitHub editing
- Collaborator repository access requires explicit push permissions

## Future Enhancements

Potential features for future versions:
- [ ] Create new files in repositories
- [ ] Export to PDF
- [ ] Collaborative editing
- [ ] Offline support with service workers
- [ ] Custom themes
- [ ] Markdown validation and linting
- [ ] Git branch management

## License

MIT License - © 2026 janu000

This project is open source and available under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to:
- Report issues
- Suggest features
- Submit pull requests

## Support

For issues, feature requests, or questions:
- Check the [GitHub Issues](https://github.com/janu000/gitMarkdownEditor/issues)
- Submit a new issue with detailed information

---

**Made with ❤️ for Markdown enthusiasts**
