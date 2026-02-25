# Git Markdown Editor - Feature Analysis

This document provides a detailed breakdown of all implemented features in the Git Markdown Editor, analyzed at the smallest unit of implementation.

## 1. Core Architecture & Editor Logic

### CodeMirror 6 Implementation (Primary)
- **Engine:** Migrated from a basic `textarea` to a professional **CodeMirror 6** editor.
- **Syntax Highlighting:** Real-time highlighting for Markdown, GFM, and nested code blocks.
- **Custom Modern Theme:** Bespoke `HighlightStyle` with a pleasant, modern color palette (Indigo, Emerald, Amber, Violet, Pink) unified across light and dark modes.
- **Highlighting Toggle:** Ability to dynamically enable/disable syntax highlighting via the toolbar.
- **Performance:** Optimized for large files using virtualization; handles 10,000+ line documents without input lag.
- **Memory Optimization (Rope Structure):** Leverages CodeMirror's internal B-Tree/Rope data structure with adaptive debounced stringification.
- **Cursor Stability:** Selection-aware content synchronization that prevents "jumping" when reconciling state from external sources.
- **Smart Editing:** 
    - Auto-bracket closing.
    - Smart indentation.
    - Line wrapping and active line highlighting.
- **Transaction-based State:** Uses CodeMirror's functional state model for robust undo/redo history and precise programmatic updates.

### Layout & Resizing
- **Tri-Pane Layout:** Collapsible Sidebar, Editor, and Preview panes.
- **Optimized Resizing:** 
    - **Fast-Path Updates:** Uses a temporary split ratio for instantaneous layout updates during dragging.
    - **Debounced Re-renders:** Heavy engine resizing is debounced to 16ms (60fps) to prevent stuttering.
    - **Resizer Overlay:** Invisible pointer-lock overlay during drag operations to prevent iframe/editor event hijacking.
- **View Modes:**
    - **Edit Mode:** Full-screen editor.
    - **Split Mode:** Side-by-side editor and preview with a slim 1px separator.
    - **Preview Mode:** Full-screen rendered output.
- **Pane-Specific Headers:** 
    - Editor pane hosts the `FormattingToolbar`.
    - Preview pane has a dedicated "PREVIEW" tracking header.

---

## 2. Markdown Parsing & Preview System

### Performance Profiling & Adaptive Rendering
- **Parsing Profiler:** Real-time monitoring of parsing duration to detect "expensive" documents.
- **Adaptive Debounce:** 
    - **Instant Path:** 0ms render delay for lightweight documents (<30ms parse time).
    - **Stable Path:** 300ms debounce for complex documents to preserve CPU resources.
- **Incremental Worker-based Parsing:**
    - **Off-Thread Processing:** Heavy parsing moved to a Web Worker.
    - **Chunked Parsing:** Logical document splitting by headers.
    - **Caching Mechanism:** Logical cache to avoid re-parsing unchanged document sections.

### Preview Features
- **Sync Scrolling (Clean Reimplementation):** 
    - **Bi-directional Sync:** Scrolling the editor moves the preview and vice-versa.
    - **Center Syncing:** Maps the document position at the *center* of the editor viewport to the *center* of the preview viewport (and vice-versa). It averages over 11 anchor points covering the entire viewport height (0% to 100% in 10% increments) to provide a more intuitive and visually stable scrolling experience, smoothing out jumps from large elements.
    - **AST-Level Accuracy:** Uses precise character offsets from the Markdown AST to map editor lines to preview elements.
    - **Layout Shift Resilience:** Employs `ResizeObserver` and capture-phase image `load` listeners to maintain scroll sync accuracy during dynamic content loading.
    - **Performance Optimizations:** 
        - **Asynchronous Batching:** Processes element measurements in small batches (100 nodes at a time) with main-thread yielding to prevent UI freezing on large documents.
        - **Adaptive Debouncing:** Prevents redundant cache recalculations during rapid edits.
        - **Scroll-Aware Throttling:** Postpones cache updates during active scrolling to avoid layout thrashing.
        - **Paint-Safe Synchronization:** Uses `requestAnimationFrame` to ensure measurements occur after the browser has completed rendering and layout.
    - **Efficient Implementation:** Uses binary search and scroll-caching for smooth performance even on large documents.
    - **Robust Loop Prevention:** Ref-based locking ensures scroll events don't trigger infinite feedback loops.
    - **Toggleable:** Can be enabled/disabled via a dedicated "Sync" button in the toolbar.
- **Independent Scrolling:** When sync is disabled, panes scroll independently.
- **Click-to-Jump (Sync):** Clicking any element in the preview scrolls the editor to the exact character offset of that element.
- **GFM Support:** Support for GitHub Flavored Markdown (Tables, Task lists, Strikethrough, Autolinks).
- **AST Source Mapping:** Custom `remarkOffsetPlugin` injects `data-offset-start` attributes for exact character-to-DOM mapping.

### Math & Equations
- **KaTeX Integration:** Full support for LaTeX math.
- **Inline Math:** Rendered via `$ ... $`.
- **Block Math:** Rendered via `$$ ... $$`.

### Table of Contents (TOC)
- **Automatic Extraction:** Scans content for `#{1,6}` headings.
- **Line Mapping:** Captures line numbers for direct navigation.
- **Dynamic TOC View:** Sidebar can switch from File Explorer to TOC mode.

---

## 3. GitHub Integration (`useGitHub.jsx`)

### Authentication
- **PAT-based Auth:** Support for GitHub Personal Access Tokens (classic).
- **Secure Persistence:** Tokens stored in `localStorage` and never logged.

### Repository Management
- **Repository Explorer:** Lists owner/collaborator repos with push permissions.
- **Branch Switcher:** Fetch and switch between all repository branches.
- **Branch Creation:** Create new branches directly from current HEAD.

### File Operations (Remote)
- **File Loading:** Fetches content and decodes Base64 (UTF-8 safe).
- **Commit/Save:** Pushes content to GitHub with Base64 encoding.
- **File CRUD:** Create, Rename, and Delete files directly on the remote repository.
- **Optimistic Updates:** Immediate UI feedback for file operations using `pendingOps`.

---

## 4. Local Workspace & File System

### Virtual File System
- **Browser-based Storage:** Full CRUD support for files stored in `localStorage`.
- **Local Draft:** Default scratchpad area that persists across refreshes.

### Native File System Access
- **Local File Import:** Uses `window.showOpenFilePicker` to read files from disk into the workspace.
- **Download:** Export current content as a `.md` file.

---

## 5. Editing & Formatting Features

### Formatting Toolbar
- **Inline Formatting:** Bold, Italic, Strikethrough, Inline Code.
- **Block Formatting:** Heading 1, Heading 2, Blockquote, Code Block, Table, Math Block.
- **List Management:** Bulleted, Numbered (auto-increment), and Task lists.
- **Emoji Picker:** Categorized popover with hundreds of emojis.

### Keyboard Shortcuts
- **Global Listener:** `useShortcuts.jsx` maps keys to editor actions.
- **YAML Configuration:** Default shortcuts defined in `shortcuts.yaml`.
- **Platform Normalization:** Automatically maps `mod` to `Cmd` on Mac and `Ctrl` on Windows/Linux.

---

## 6. UI/UX & Quality of Life

### Theme System
- **Dark/Light Mode:** Full UI support for GitHub-style themes.
- **Visual Feedback:** Toast notifications, unsaved changes indicators, and breadcrumbs.

### Export & Printing
- **PDF Export:** Optimized `@media print` rules for the preview pane.

### PWA (Progressive Web App)
- **Vite PWA Plugin:** Offline usage support and Service Worker registration.

---

## 8. Recent Fixes & Refinements

- **Editor-Preview Sync Fix:** Resolved an issue where loading a file would update the preview but fail to update the CodeMirror editor. This was caused by a redundant `useEffect` in `CodeMirrorEditor.jsx` that prematurely updated the internal content reference, blocking the external update detection logic.
- **Robust Transaction Handling:** Refined the synchronization between the React `content` state and the CodeMirror `EditorState` to ensure external loads (from GitHub or Local Workspace) correctly trigger a document dispatch while avoiding feedback loops from internal editor changes.

---

## 7. Technical Implementation Details

- **Iconography:** Consistent `lucide-react` usage.
- **UTF-8 Safe Base64:** Custom encoding utilities for special character support.
- **Custom Vite Debug Logger:** Intercepts build errors and writes to `debug.log` for agent diagnostics.
