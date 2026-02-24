# Git Markdown Editor - Feature Analysis

This document provides a detailed breakdown of all implemented features in the Git Markdown Editor, analyzed at the smallest unit of implementation.

## 1. Core Architecture & Editor Logic

### CodeMirror 6 Implementation (Primary)
- **Engine:** Migrated from a basic `textarea` to a professional **CodeMirror 6** editor.
- **Syntax Highlighting:** Real-time highlighting for Markdown, GFM, and nested code blocks.
- **Dynamic Theming:** Seamless switching between Light and Dark modes using CodeMirror `Compartment` and `oneDark` theme.
- **Performance:** Optimized for large files using virtualization; handles 10,000+ line documents without input lag.
- **Memory Optimization (Rope Structure):** Leverages CodeMirror's internal B-Tree/Rope data structure by using debounced stringification (300ms) to prevent expensive JavaScript string reallocations on every keystroke.
- **Smart Editing:** 
    - Auto-bracket closing.
    - Smart indentation.
    - Line wrapping and active line highlighting.
- **Transaction-based State:** Uses CodeMirror's functional state model for robust undo/redo history and precise programmatic updates.

### State & Persistence
- **LocalStorage Draft Persistence:** Automatically saves current editor content to `gme_draft` with a 1-second debounce to prevent data loss.
- **Deferred Rendering:** Uses React 19's `useDeferredValue` for markdown parsing to ensure the editor remains responsive during heavy parsing tasks.
- **Workspace State Management:** `useWorkspace.jsx` maintains a virtual file system in `localStorage` under `gme_local_workspace`.

### Layout & Resizing
- **Tri-Pane Layout:** Collapsible Sidebar, Editor, and Preview panes.
- **Sidebar Resizing:** Interactive dragging to adjust sidebar width (constrained between 150px and 600px).
- **Split-Pane Resizing:** Interactive dragging to adjust the ratio between Editor and Preview (constrained between 20% and 80%).
- **View Modes:**
    - **Edit Mode:** Full-screen editor.
    - **Split Mode:** Side-by-side editor and preview.
    - **Preview Mode:** Full-screen rendered output.
- **Sidebar Toggle:** Ability to completely hide the explorer for focus.

---

## 2. Markdown Parsing & Preview System

### Incremental Worker-based Parsing
- **Off-Thread Processing:** Heavy Markdown parsing moved to a Web Worker to keep the UI thread responsive.
- **Chunked Parsing:** Documents are split into logical chunks (by headers) so only modified sections are re-processed.
- **Caching Mechanism:** Uses a chunk-based cache to avoid re-parsing unchanged document sections.
- **Unified AST Parser:** Uses `unified`, `remark-parse`, `remark-gfm`, `remark-math`, `remark-emoji`, `rehype-katex`, and `rehype-stringify`.

### Synchronized Scrolling (Precision Sync)
- **Piecewise Linear Interpolation:** Uses a monotonic mapping between editor line blocks and preview DOM elements to ensure perfectly smooth, jiggle-free scrolling.
- **Anchor-based Tracking:** Identifies dual anchor points (straddling elements) and calculates exact sub-pixel progress between them.
- **Master/Slave Locking:** Implements a directional lock to prevent "sync fighting" and reverse-scrolling during momentum/inertia.
- **AST Source Mapping:** Custom `remarkOffsetPlugin` injects `data-offset-start` attributes into rendered HTML elements for exact character-to-DOM mapping.

### Math & Equations
- **KaTeX Integration:** Full support for LaTeX math.
- **Inline Math:** Rendered via `$ ... $`.
- **Block Math:** Rendered via `$$ ... $$` with display mode formatting.
- **Dynamic CSS Loading:** Programmatically injects KaTeX stylesheets into the document head.

### Table of Contents (TOC)
- **Automatic Extraction:** Scans content for `#{1,6}` headings.
- **Line Mapping:** Captures the line number for every heading for direct navigation.
- **Dynamic TOC View:** Sidebar can switch from File Explorer to TOC mode.
- **Nested Hierarchy:** Supports 6 levels of headings with indented UI.
- **Collapsible Headings:** Ability to collapse/expand heading sections in the TOC sidebar.

### Preview Features
- **Click-to-Jump (Sync):** Clicking any element in the preview scrolls the editor to the exact character offset of that element.
- **GFM Support:** Support for GitHub Flavored Markdown (Tables, Task lists, Strikethrough, Autolinks).
- **HTML Sanitization:** Safe rendering of dangerous HTML via `allowDangerousHtml` configurations in unified.
- **Fallback Parser:** Automatically switches to `Marked.js` if the heavy AST parser fails to load (e.g., CSP or network issues).

---

## 3. GitHub Integration (`useGitHub.jsx`)

### Authentication
- **PAT-based Auth:** Support for GitHub Personal Access Tokens (classic) with `repo` scope.
- **Secure Persistence:** Tokens stored in `localStorage` and never logged.
- **Token Verification:** Validates tokens against `/user` endpoint and fetches profile data (avatar, login).

### Repository Management
- **Repository Explorer:** Fetches and lists all owner and collaborator repositories with push permissions.
- **Hide/Restore Repos:** Ability to hide specific repositories from the explorer with persistence.
- **Manual Repository Entry:** Support for accessing repositories not listed (owner/repo).
- **Branch Switcher:** Fetch and switch between all branches of a repository.
- **Branch Creation:** Create new branches directly from the current HEAD.

### File Operations (Remote)
- **Directory Navigation:** Breadcrumb-style path stack for navigating deep repo structures.
- **File Loading:** Fetches file content and decodes Base64 (UTF-8 safe).
- **Commit/Save:** Pushes content to GitHub with a default commit message; handles Base64 encoding.
- **File CRUD:** Create, Rename, and Delete files directly on the remote repository.
- **Optimistic Updates:** Immediate UI feedback for file operations using `pendingOps` state.
- **Sync States:** Visual indicators (spinners, "Syncing" text, pulsing icons) for background operations.

---

## 4. Local Workspace & File System

### Virtual File System
- **Browser-based Storage:** Full CRUD support for files stored in `localStorage`.
- **Local Draft:** A default scratchpad area that persists across refreshes without needing a named file.

### Native File System Access
- **Local File Import:** Uses the `window.showOpenFilePicker` (File System Access API) to read files from the user's actual disk into the workspace.
- **Download:** Export current content as a `.md` file to the user's downloads folder.

---

## 5. Editing & Formatting Features

### Formatting Toolbar
- **Inline Formatting:** Bold, Italic, Strikethrough, Inline Code.
- **Block Formatting:** Heading 1, Heading 2, Blockquote, Code Block, Table, Math Block.
- **List Management:**
    - Bulleted lists.
    - Numbered lists with auto-incrementing integers.
    - Task lists (Checkboxes).
- **Link & Image Helpers:** Snippet insertion for Markdown links and images.

### Keyboard Shortcuts
- **Global Listener:** `useShortcuts.jsx` maps keys to editor actions.
- **YAML Configuration:** Default shortcuts defined in `shortcuts.yaml`.
- **Customization Interface:** `ShortcutModal.jsx` allows users to record and override any shortcut.
- **Platform Normalization:** Automatically maps `mod` to `Cmd` on Mac and `Ctrl` on Linux/Windows.
- **Interactive Recording:** Modal intercepts keys to record new combinations without triggering actions.

### Emoji Support
- **Emoji Picker:** Categorized popover with hundreds of emojis.
- **Shortcode Transformation:** (Planned/Partial) - Logic exists in `utils/emojis.js` to parse shortcodes.

---

## 6. UI/UX & Quality of Life

### Theme System
- **Dark/Light Mode:** Full UI support for GitHub-style light and dark themes.
- **System Preference Sync:** Defaults to user's OS theme preference.
- **Transition-less Resizing:** Layout resizing is optimized to prevent UI lag.

### Visual Feedback
- **Toast Notifications:** Feedback for success, error, and info states (Saved, Deleted, Error, etc.).
- **Unsaved Changes Indicator:** Visual dot in the toolbar when content differs from the last saved state.
- **Breadcrumbs:** Path navigation in the sidebar for both Local and GitHub workspaces.
- **Responsive Preview:** `max-w-3xl` centering for readability.

### Export & Printing
- **PDF Export:** Specialized CSS `@media print` rules to optimize the preview for printing.
- **Print Optimization:** Hides UI elements, forces light mode colors, prevents breaking equations/blocks across pages.

### PWA (Progressive Web App)
- **Vite PWA Plugin:** Configured for offline usage and "Install" support.
- **Service Worker:** Registered in `main.jsx` for asset caching.

---

## 7. Technical Implementation Details

- **Iconography:** Uses `lucide-react` for consistent, accessible icons.
- **Styling:** Tailwind CSS for utility-first responsive design.
- **AST Syncing:** Precise character-to-DOM offset mapping for both "Click-to-Jump" and "Synchronized Scrolling".
- **UTF-8 Safe Base64:** Custom `utf8_to_b64` and `b64_to_utf8` utilities using `encodeURIComponent` to handle special characters and emojis in GitHub commits.
- **Custom Vite Debug Logger:** A specialized Vite plugin (`agentDebugPlugin`) that intercepts build/server errors and writes them to `debug.log` for agent-based diagnostics.
- **Standalone Mode Support:** The project maintains a `html-standalone/index.html` (though noted as discontinued in `GEMINI.md`, the code exists for historical/portable reference).
