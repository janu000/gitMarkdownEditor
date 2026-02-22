# Welcome to Git Markdown Editor (MarkHub)

A powerful, browser-based Markdown editor built with React and Vite, offering seamless GitHub integration for syncing and managing your documentation directly from your browser. "MarkHub" is the project's personal name.


## Features

✨ **Rich Markdown Editing**
- **Live WYSIWYG Preview**: Real-time rendering with synchronized scrolling between the editor and preview panes.
- **GFM Support**: Full support for GitHub Flavored Markdown (via Marked.js).
- **Multiple View Modes**: 
  - **Split View**: Side-by-side editor and live preview.
  - **Edit Mode**: Focused, full-width Markdown editor.
  - **Preview Mode**: Clean, full-width rendered view.
- **Dynamic Syntax Highlighting**: Inlined and block code formatting with themed backgrounds.

📐 **Advanced Math Support**
- **KaTeX Integration**: High-performance LaTeX math rendering for both inline and block formulas.
- **Syntax**: Use `$inline formula$` for inline math and `$$block formula$$` for standalone math blocks.
- **CDN Loading**: Dynamically loads KaTeX resources only when needed.

🔗 **GitHub Integration**
- **Direct Sync**: Authenticate with a Personal Access Token (PAT) to manage files directly in your GitHub repositories.
- **Repository Explorer**: Browse owned and collaborator repositories with support for nested directories.
- **File Management**: Create, rename, delete, and edit files directly within the GitHub repository.
- **Optimistic UI**: Real-time feedback for file operations with "Pending/Syncing" states while GitHub API calls complete.
- **Manual Repository Entry**: Access any public or accessible repository by entering `owner/repo`.
- **Privacy Controls**: Hide or restore specific repositories from your explorer view.

🎨 **Smart & Responsive UI**
- **Interactive Resizing**: Drag-and-drop handles to adjust sidebar width and the editor/preview split ratio.
- **Theme Support**: Seamlessly toggle between Light and GitHub-inspired Dark mode (persisted in `localStorage`).
- **Toast Notifications**: Real-time feedback for operations like saves, commits, and errors.
- **Responsive Sidebar**: Toggleable explorer for maximum writing space.

💾 **Local & Cloud Storage**
- **Auto-Save Drafts**: Your work-in-progress is automatically saved to browser `localStorage` to prevent data loss.
- **Local Workspace**: Manage local files directly in the browser's storage without a GitHub connection.
- **File System Access API**: Import and save files directly to your computer's local file system (in supported browsers).
- **PDF Export**: Generate high-quality PDF documents from your Markdown using the built-in print styling.
- **Download as Markdown**: Quickly save your current work as a `.md` file to your local machine.

🛠️ **Formatting Toolbar**
Quick-insert buttons for:
- Text styles (bold, italic, strikethrough)
- Headings (H1, H2)
- Links and images
- Code blocks and inline code
- Lists (unordered, ordered, and task lists)
- Blockquotes
- Tables
- Mathematical formulas (KaTeX)
- Checkboxes (Task Lists)

## Getting Started

### Prerequisites
- Node.js and npm installed
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A GitHub Personal Access Token (for GitHub sync features)

### Running Locally

1.  **Clone the repository**:
    ```bash
    git clone [repository-url]
    cd git-markdown-editor
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Start Development Server**:
    ```bash
    npm run dev
    ```
    This will start a development server, usually accessible at `http://localhost:5173`.

### Usage

1.  **Open the editor**: Access `http://localhost:5173` in your web browser.
2.  **Connect GitHub (optional)**:
    - Click "Connect Account" in the sidebar
    - Enter your GitHub Personal Access Token (classic) with `repo` scope
    - Your repositories will load automatically

3.  **Start editing**:
    - Write or paste Markdown in the editor
    - See live preview in real-time
    - Use the toolbar for quick formatting

4.  **GitHub Sync**:
    - Click on a repository in the sidebar
    - Browse and select files to edit
    - Make changes in the editor
    - Click "Save to GitHub" to commit changes

## Creating a GitHub Personal Access Token

To enable GitHub synchronization:

1. Go to GitHub Settings → Developer settings → [Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Set the scope to `repo` (Full control of private repositories)
4. Copy the token and paste it into Git Markdown Editor

⚠️ **Security Note**: Keep your token private. It's stored in your browser's localStorage and never sent to external servers (only to GitHub's official API).

## Technology Stack

-   **Frontend Framework**: React 19 (with Vite)
-   **Markdown Parser**: [Marked.js](https://marked.js.org/)
-   **Math Rendering**: [KaTeX](https://katex.org/)
-   **CSS Framework**: [Tailwind CSS](https://tailwindcss.com/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **API Integration**: GitHub REST API v3
-   **Code Quality**: ESLint, Prettier

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

Enhance your editing workflow with these intuitive shortcuts:

### File & System
*   **Save / Commit**: `Ctrl/Cmd + S`
*   **Export to PDF**: `Ctrl/Cmd + P`
*   **Toggle Sidebar**: `Ctrl/Cmd + Alt + O`
*   **Toggle Theme**: `Ctrl/Cmd + Alt + D`

### View Modes
*   **Toggle Editor Only View**: `Ctrl/Cmd + Shift + 1`
*   **Toggle Split View**: `Ctrl/Cmd + Shift + 2`
*   **Toggle Preview Only View**: `Ctrl/Cmd + Shift + 3`

### Text Formatting
*   **Bold**: `Ctrl/Cmd + B`
*   **Italic**: `Ctrl/Cmd + I`
*   **Strikethrough**: `Ctrl/Cmd + Shift + S`
*   **Link**: `Ctrl/Cmd + K`
*   **Image**: `Ctrl/Cmd + Alt + I`

### Structural Elements
*   **Bullet List**: `Ctrl/Cmd + Shift + U`
*   **Numbered List**: `Ctrl/Cmd + Shift + O`
*   **Task List**: `Ctrl/Cmd + Shift + L`
*   **Blockquote**: `Ctrl/Cmd + Shift + Q`
*   **Code Block**: `Ctrl/Cmd + Alt + C`
*   **Inline Code**: `Ctrl/Cmd + Alt + \``
*   **Table**: `Ctrl/Cmd + Alt + T`
*   **Math Block**: `Ctrl/Cmd + Alt + M`

## Project Structure

```
git-markdown-editor/
├── public/                 # Static assets
├── src/                    # Source code
│   ├── App.jsx             # Main application component
│   ├── main.jsx            # Entry point for React
│   └── index.css           # Global styles
├── index.html              # Main HTML file
├── package.json            # Project dependencies and scripts
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── eslint.config.js        # ESLint configuration
├── README.md               # This file
└── LICENSE                 # MIT License
```

## Browser Compatibility

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Local Storage

Git Markdown Editor stores the following in your browser's localStorage for persistence:

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
