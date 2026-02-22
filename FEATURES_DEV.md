# MarkHub Development Feature Checklist

This document tracks the technical implementation status of MarkHub features. It serves as a reference for developers to understand the current capabilities and planned improvements.

## 🟢 Core Editor Engine
- [x] **Live Markdown Parsing**: Integrated `Marked.js` for GFM support.
- [x] **Synchronized Scrolling**: High-precision scroll syncing between Editor (`textarea`) and Preview (`div`).
- [x] **View Modes**:
    - [x] `edit`: Full-screen editor.
    - [x] `split`: 50/50 or custom ratio split.
    - [x] `preview`: Full-screen rendered HTML.
- [x] **Toolbar Utilities**: `insertText` and `insertListItem` helper functions for cursor-aware formatting.
- [x] **Autosave**: Debounced/Effect-based persistence to `localStorage` (`markhub_draft`).
- [ ] **Rich Text / WYSIWYG**: Direct editing in the preview pane.
- [ ] **Find & Replace**: Search functionality within the editor.

## 🔵 GitHub Integration (REST API v3)
- [x] **Authentication**: PAT-based auth with `repo` scope validation.
- [x] **Token Persistence**: Automatic verification on component mount for seamless sessions.
- [x] **Repository Browser**:
    - [x] List owned/collaborator repos (filtered by `push` permission).
    - [x] Manual repository entry (`owner/repo`).
    - [x] Repository hiding/blacklisting (`markhub_hidden_repos`).
- [x] **File Explorer**:
    - [x] Recursive directory navigation (`pathStack`).
    - [x] File CRUD: Create, Rename, Delete with optimistic UI updates.
    - [x] Binary/Unsupported file filtering.
- [x] **Commit Logic**: Base64 encoding/decoding for UTF-8 content sync.
- [x] **Pending Operations**: State tracking for async operations (`pendingOps`) to show "Syncing" status.
- [ ] **Branch Management**: Support for switching and creating branches.
- [ ] **Pull Request Integration**: Create PRs directly from the editor.

## 🟠 Local Workspace & File System
- [x] **In-Browser Workspace**: Virtual file system stored in `localStorage` (`markhub_local_workspace`).
- [x] **File System Access API**: `window.showOpenFilePicker` for native file system interaction.
- [x] **Local File CRUD**: Create, rename, and delete local virtual files.
- [x] **Download/Export**: 
    - [x] Download as `.md` file.
    - [x] Export to PDF via `window.print()` and CSS `@media print`.
- [ ] **IndexedDB Persistence**: Support for larger files/projects beyond `localStorage` limits.

## 🎨 UI/UX & Layout
- [x] **Responsive Sidebar**: Resizable sidebar with `isResizingSidebar` state.
- [x] **Flexible Split**: Adjustable editor/preview ratio with `isResizingSplit` state.
- [x] **Theme Engine**: 
    - [x] Dark/Light mode toggle.
    - [x] System preference detection (`prefers-color-scheme`).
- [x] **Toast System**: Global notification overlay for feedback.
- [x] **Keyboard Shortcuts**: Global `keydown` listener for 15+ formatting and system commands.
- [x] **Loading States**: Granular loading indicators for `fetching`, `verifying`, and `saving`.

## 📐 Advanced Rendering
- [x] **KaTeX Integration**: 
    - [x] Inline math `$ ... $`.
    - [x] Block math `$$ ... $$`.
    - [x] Dynamic CDN injection for styles and scripts.
- [x] **Code Highlighting**: Basic themed styling for code blocks.
- [ ] **Mermaid.js Diagrams**: Support for flowcharts and diagrams.
- [ ] **Emoji Support**: Native emoji picker or `:emoji:` shortcodes.

## 🛠 Technical Debt & Maintenance
- [ ] **Component Decomposition**: Break down the monolithic `App.jsx` into modular components.
- [ ] **Unit Testing**: Add Vitest/Jest for utility functions (encoding, parsing).
- [ ] **E2E Testing**: Add Playwright/Cypress for GitHub flow verification.
- [ ] **Type Safety**: Migrate to TypeScript for better state management.
