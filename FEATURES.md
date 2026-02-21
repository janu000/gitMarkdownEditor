# MarkHub Features & Roadmap

This document outlines the current feature set of MarkHub and serves as a roadmap for future development.

## ✅ Current Features

### Core Editor
- [x] **Split View:** Real-time side-by-side editing and preview.
- [x] **View Modes:** Toggle between Editor Only, Preview Only, and Split View.
- [x] **Markdown Support:** Full GFM (GitHub Flavored Markdown) support via `marked.js`.
- [x] **Math Support:** LaTeX rendering for inline (`$`) and block (`$$`) math expressions using `KaTeX`.
- [x] **Toolbar:** Formatting buttons for Bold, Italic, Headings, Lists, Tasks, Quotes, Links, Images, Tables, Code Blocks, Math, and Strikethrough.
- [x] **Sync Scrolling:** Synchronized scrolling between the editor and preview panes.
- [x] **Auto-Save:** Continuously saves the current draft to the browser's `localStorage` to prevent data loss.

### GitHub Integration
- [x] **Authentication:** Secure connection using GitHub Personal Access Tokens (Classic) with `repo` scope.
- [x] **Repository Browser:** List and filter repositories where the user is an owner or collaborator.
- [x] **File Explorer:** Navigate directory structures within repositories.
- [x] **File Loading:** Open and edit Markdown (`.md`, `.mdx`) and Text (`.txt`) files directly from GitHub.
- [x] **Pull Updates:** Fetch the latest version of the file from GitHub.
- [x] **Conflict Resolution:** Detect and handle merge conflicts (Keep Local, Keep Remote, or Keep Remote & Save Local as New File).
- [x] **Commit Changes:** Save edits back to GitHub with a commit message.
- [x] **Manual Repository Entry:** Access public or private repositories by manually entering `owner/repo`.
- [x] **Repository Filtering:** Hide specific repositories from the list (persisted in local storage).

### UI/UX
- [x] **Dark Mode:** A sleek, developer-friendly dark interface.
- [x] **Responsive Sidebar:** Collapsible file explorer for maximizing screen real estate.
- [x] **Toast Notifications:** Non-intrusive alerts for success, errors, and loading states.
- [x] **Loading Indicators:** Visual feedback during network operations (fetching repos, saving files).

---

## 🚀 Roadmap & Planned Features

### Editor Enhancements
- [ ] **Syntax Highlighting (Editor):** Implement a code-aware editor (e.g., CodeMirror or Monaco) for syntax highlighting within the input area itself.
- [ ] **Line Numbers:** Display line numbers in the editor for easier reference.
- [ ] **Word & Character Count:** Real-time statistics in the status bar.
- [ ] **Find & Replace:** Search functionality within the editor.
- [ ] **Image Upload:** Drag-and-drop image uploading (to GitHub or an external host like Imgur).
- [ ] **Mermaid Diagrams:** Support for rendering charts and diagrams using Mermaid.js.

### File Management
- [ ] **Create New File:** Ability to create new files directly within a GitHub repository.
- [ ] **Delete File:** Option to delete files from the repository.
- [ ] **Rename File:** Ability to rename existing files.
- [ ] **Local File Support:** Open and save files from/to the user's local device file system (using the File System Access API).
- [ ] **Export Options:** Export the current document as PDF, HTML, or raw Markdown.

### GitHub Workflow
- [ ] **Branch Management:** Create and switch branches.
- [ ] **Pull Requests:** Basic PR creation workflow.
- [ ] **Commit History:** View a list of recent commits for the current file.
- [ ] **Diff View:** Visual comparison of changes before committing.

### Customization & Settings
- [ ] **Themes:** Light mode and custom theme support.
- [ ] **Font Settings:** Adjustable font size and font family.
- [ ] **Keyboard Shortcuts:** Customizable keybindings for common actions (Save, Format, Toggle View).
- [ ] **PWA Support:** Service worker implementation for offline capability.
