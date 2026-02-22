# Git Markdown Editor

The **Git Markdown Editor** is a professional-grade, browser-based Markdown environment designed for developers and writers who demand seamless integration between their local workflow and GitHub repositories. Built with a focus on speed, precision, and aesthetics, it offers a client-side-only architecture that ensures your data remains secure and private.

**Access the application live at: [git-markdown-editor.vercel.app](https://git-markdown-editor.vercel.app/)**

## ✨ Core Features

### 🖋️ Professional Writing Environment
- **High-Precision Live Preview**: Real-time GFM (GitHub Flavored Markdown) rendering with synchronized scrolling.
- **Three View Modes**:
    - **Edit**: Maximum focus on content.
    - **Split**: Balanced 50/50 or custom-ratio view (fully resizable).
    - **Preview**: Final document verification.
- **Advanced Math Support**: Native LaTeX rendering via KaTeX for both inline (`$ ... $`) and block (`$$ ... $$`) equations.
- **Rich Media Integration**: Support for images, links, tables, and task lists with dedicated formatting tools.
- **Emoji Ecosystem**: Integrated emoji picker with categories (Gitmojis, Status, Docs, Infra) and `:shortcode:` support.

### ☁️ Deep GitHub Integration
- **Direct REST API Sync**: Authenticate via Personal Access Token (PAT) for full repository access.
- **Optimistic UI Updates**: File operations (Create, Rename, Delete) reflect immediately in the UI while syncing in the background.
- **Branch Management**: Switch between existing branches or create new ones directly from the explorer.
- **Repository Browser**: Filter your accessible repositories or manually enter any public/private `owner/repo` to start editing.
- **Base64 Syncing**: Automatic handling of GitHub's content encoding for seamless UTF-8 text synchronization.

### 📂 Workspace & File Management
- **Local Virtual Workspace**: A persistent, in-browser workspace stored in `localStorage` for quick drafts and offline work.
- **File System Access API**: Direct interaction with your local computer's files (`window.showOpenFilePicker`).
- **Flexible Export**: 
    - **Markdown**: Download current drafts as `.md` files.
    - **PDF**: Professional-grade PDF export using custom `@media print` styles and browser print engines.

### 🎨 Modern UX & Customization
- **Intelligent Theming**: Dark and light mode support with automatic system preference detection.
- **Resizable Layouts**: Draggable resizers for both the file explorer sidebar and the editor/preview split ratio.
- **Toast Notifications**: Global feedback system for sync status, errors, and confirmations.
- **PWA Capabilities**: Installable as a standalone desktop or mobile application for an "app-like" experience.

## ⌨️ Keyboard Shortcuts

| Command | Mac | Windows/Linux |
|---------|-----|---------------|
| **Save to GitHub** | `⌘ + S` | `Ctrl + S` |
| **Export to PDF** | `⌘ + P` | `Ctrl + P` |
| **Bold** | `⌘ + B` | `Ctrl + B` |
| **Italic** | `⌘ + I` | `Ctrl + I` |
| **Strikethrough** | `⌘ + Shift + S` | `Ctrl + Shift + S` |
| **Link** | `⌘ + K` | `Ctrl + K` |
| **Image** | `⌘ + Alt + I` | `Ctrl + Alt + I` |
| **Unordered List** | `⌘ + Shift + U` | `Ctrl + Shift + U` |
| **Numbered List** | `⌘ + Shift + O` | `Ctrl + Shift + O` |
| **Task List** | `⌘ + Shift + L` | `Ctrl + Shift + L` |
| **Quote** | `⌘ + Shift + Q` | `Ctrl + Shift + Q` |
| **Code Block** | `⌘ + Alt + C` | `Ctrl + Alt + C` |
| **Inline Code** | `` ⌘ + Alt + ` `` | `` Ctrl + Alt + ` `` |
| **Table** | `⌘ + Alt + T` | `Ctrl + Alt + T` |
| **Math Block** | `⌘ + Alt + X` | `Ctrl + Alt + X` |

## 🛠️ Technical Architecture

### Tech Stack
- **Framework**: [React 19](https://react.dev/) (Hooks, Memoization, Refs)
- **Build System**: [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Markdown Engine**: [Marked.js](https://marked.js.org/)
- **Math Engine**: [KaTeX](https://katex.org/)

### Key Mechanisms
1. **Dynamic Loading**: KaTeX and Marked.js are loaded via CDN only when needed to minimize initial bundle size.
2. **Optimistic State**: The `pendingOps` state tracks asynchronous GitHub actions, allowing the UI to remain responsive during network latency.
3. **Ref-Based Synchronization**: High-precision scroll syncing uses React refs and scroll ratio calculations to ensure alignment even with disparate content types (images/tables).
4. **Custom Vite Logging**: Includes a specialized `agentDebugPlugin` that pipes build and server errors directly to a `debug.log` file for streamlined debugging.

## 🚥 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher

### Installation & Development
1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/git-markdown-editor.git
   cd git-markdown-editor
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Launch dev server**:
   ```bash
   npm run dev
   ```
4. **Build for production**:
   ```bash
   npm run build
   ```

## 🔒 Security & Content Policy (CSP)
The Git Markdown Editor is **100% client-side**. 

- **Token Privacy**: Your GitHub Personal Access Tokens are stored only in your browser's `localStorage` and never sent to third-party servers.
- **Data Privacy**: Your content is transmitted directly between your browser and the official GitHub API.


## 🤝 Collaboration & Feedback

We love community involvement! Whether you're fixing a bug, suggesting a feature, or improving documentation, your help is welcome.

- **Found a bug?** Please open an [issue](https://github.com/janu000/gitMarkdownEditor/issues) with a detailed description and steps to reproduce.
- **Have an idea?** We're always looking for ways to make the editor better. Feel free to share your thoughts in the discussions.
- **Want to contribute?** Fork the repo, create a branch, and submit a PR. We'll review it as soon as possible!

Let's build the best browser-based Markdown experience together. ✨

## 📝 License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
