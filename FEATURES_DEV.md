# Git Markdown Editor Development Feature Checklist

This document tracks the technical implementation status of Git Markdown Editor features. It serves as a reference for developers to understand the current capabilities and planned improvements.

## 🟢 Core Editor Engine
- [x] **Live Markdown Parsing**: Integrated `Marked.js` for GFM support.
- [x] **Synchronized Scrolling**: High-precision scroll syncing between Editor (`textarea`) and Preview (`div`).
- [x] **Token-Level Cursor Syncing**:
    - [x] **AST Parsing**: Migrated to `unified`, `remark`, and `rehype` for exact character offset tracking.
    - [x] **HTML Injection**: Custom rehype plugin injecting `data-offset-start` and `data-offset-end` attributes.
    - [x] **Bi-directional Sync**: 
        - [x] Preview -> Editor: Clicking elements in preview jumps editor to exact offset.
        - [x] Editor -> Preview: Editor cursor movement highlights and scrolls to corresponding element in preview.
- [x] **View Modes**:
    - [x] `edit`: Full-screen editor.
    - [x] `split`: 50/50 or custom ratio split.
    - [x] `preview`: Full-screen rendered HTML.
- [x] **Table of Contents Explorer**:
    - [x] Double-click any Markdown file to browse headings as a virtual directory layer.
    - [x] **Inline Rendering**: Correctly renders bold, italic, and code formatting within headings.
    - [x] **Hierarchy**: Dynamic font sizing, spacing, and indenting based on heading level.
    - [x] **Interactivity**: Expand/Collapse sub-headings via chevron toggles.
    - [x] **Live Updates**: TOC syncs in real-time as you type in the active file.
    - [x] **Deep Linking**: Click heading to jump directly to the line in the editor.
- [x] **Toolbar Utilities**: `insertText` and `insertListItem` helper functions for cursor-aware formatting.
- [x] **Autosave**: Debounced/Effect-based persistence to `localStorage` (`gme_draft`).
- [ ] **Rich Text / WYSIWYG**: Direct editing in the preview pane.
- [ ] **Find & Replace**: Search functionality within the editor.

## 🔵 GitHub Integration (REST API v3)
- [x] **Authentication**: PAT-based auth with `repo` scope validation.
- [x] **Token Persistence**: Automatic verification on component mount for seamless sessions.
    - [x] **Resilient Logic**: Token is only removed on explicit 401 errors, not transient network issues.
- [x] **Repository Browser**:
    - [x] List owned/collaborator repos (filtered by `push` permission).
    - [x] Manual repository entry (`owner/repo`).
    - [x] Repository hiding/blacklisting (`gme_hidden_repos`).
- [x] **File Explorer**:
    - [x] Recursive directory navigation (`pathStack`).
    - [x] File CRUD: Create, Rename, Delete with optimistic UI updates.
    - [x] Binary/Unsupported file filtering.
- [x] **Commit Logic**: Base64 encoding/decoding for UTF-8 content sync.
    - [x] **Optimistic Commits**: Sidebar shows "Syncing" status immediately upon commit.
- [x] **Smart Caching**:
    - [x] **Latency Reduction**: Uses browser cache for file reads to speed up navigation.
    - [x] **Freshness**: Uses `no-store` for directory listing and metadata changes.
    - [x] **Post-Commit Sync**: Automatically performs a cache-busting reload after successful commits.
- [x] **Branch Management**: Support for switching and creating branches.
    - [x] **Force Refresh**: Update button re-syncs the complete branch list from GitHub.
- [ ] **Pull Request Integration**: Create PRs directly from the editor.

## 🟠 Local Workspace & File System
- [x] **In-Browser Workspace**: Virtual file system stored in `localStorage` (`gme_local_workspace`).
- [x] **File System Access API**: `window.showOpenFilePicker` for native file system interaction.
- [x] **Local File CRUD**: Create, rename, and delete local virtual files.
- [x] **Download/Export**: 
    - [x] Download as `.md` file.
    - [x] Export to PDF via `window.print()` and CSS `@media print`.

## 🎨 UI/UX & Layout
- [x] **Responsive Sidebar**: Resizable sidebar with `isResizingSidebar` state.
- [x] **Flexible Split**: Adjustable editor/preview ratio with `isResizingSplit` state.
- [x] **Theme Engine**: 
    - [x] Dark/Light mode toggle.
    - [x] System preference detection (`prefers-color-scheme`).
- [x] **Toast System**: Global notification overlay for feedback.
- [x] **Keyboard Shortcut System**:
    - [x] **YAML Defaults**: Configuration-driven shortcuts via `shortcuts.yaml`.
    - [x] **Customization UI**: Dedicated modal for recording personal client-side shortcuts.
    - [x] **Persistence**: Overrides saved to `localStorage` (`gme_custom_shortcuts`).
    - [x] **Contextual Tooltips**: Toolbars dynamically display the active keyboard shortcuts on hover.
- [x] **Loading States**: Granular loading indicators for `fetching`, `verifying`, and `saving`.

## 📐 Advanced Rendering
- [x] **KaTeX Integration**: 
    - [x] Inline math `$ ... $`.
    - [x] Block math `$$ ... $$`.
    - [x] Dynamic CDN injection for styles and scripts.
- [x] **Code Highlighting**: Basic themed styling for code blocks.
- [ ] **Mermaid.js Diagrams**: Support for flowcharts and diagrams.
- [x] **Emoji Support**: Native emoji picker and `:emoji:` shortcodes.
- [x] **Categorized Emoji Picker**: Organized sections for Gitmojis, Status, Docs, and Infra.

## 🛠 Technical Debt & Maintenance
- [x] **Component Decomposition**: Break down the monolithic `App.jsx` into modular components.
- [ ] **Unit Testing**: Add Vitest/Jest for utility functions (encoding, parsing).
- [ ] **E2E Testing**: Add Playwright/Cypress for GitHub flow verification.
- [ ] **Type Safety**: Migrate to TypeScript for better state management.


