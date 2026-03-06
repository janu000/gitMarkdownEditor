# Git Markdown Editor - Feature Analysis

This document provides a detailed breakdown of all implemented features in the Git Markdown Editor, analyzed at the smallest unit of implementation.

## 1. Core Architecture & Editor Logic

### CodeMirror 6 Implementation (Primary)
- **Engine:** Migrated from a basic `textarea` to a professional **CodeMirror 6** editor.
- **Custom Search Tool:** Implemented a modern, clean search and replace interface that mimics the VS Code experience.
    - **UI:** Custom React component (`SearchPanel.jsx`) with Tailwind CSS styling.
    - **Functionality:** 
        - Integrated with `@codemirror/search` logic but with a completely custom UI.
        - Supports Find and Replace (collapsible).
        - Search options: Match Case, Match Whole Word, and Regular Expression.
        - Navigation: Find Next (Enter/F3) and Find Previous (Shift+Enter/Shift+F3).
        - Actions: Replace (Enter in replace field) and Replace All (Ctrl+Alt+Enter).
    - **Shortcuts:**
        - `mod+f`: Open/Focus search.
        - `mod+h`: Open/Focus replace.
        - `Esc`: Close search panel.
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
    - **Scroll Past End:** Enabled scrolling beyond the last line of the document for better vertical positioning.
- **Transaction-based State:** Uses CodeMirror's functional state model for robust undo/redo history and precise programmatic updates.

### Multi-File Persistence (IndexedDB)
- **Engine:** Migrated from single-key `localStorage` to a robust **IndexedDB** solution using `localforage`.
- **Dual-Versioning System:** Every opened file is stored in two states:
    - `original_[path]`: The baseline text fetched from GitHub. Updates only on initial load or successful commit.
    - `draft_[path]`: The user's active workspace. Updates continuously via auto-save.
- **Per-File Auto-Save:** Implemented a **500ms debounced auto-save** that persists the current editor state specifically to the active file's IndexedDB draft record.
- **Session Restoration:** The application now remembers the last active file via `gme_last_active_file` in `localStorage` and automatically restores its latest local draft (or re-fetches from GitHub) on startup.
- **Conflict Resilience:** By storing the `original` baseline, the system can eventually support diffing and conflict resolution between local drafts and remote GitHub changes.

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
- **Sync Scrolling (High Precision):** 
    - **Bi-directional Sync:** Scrolling the editor moves the preview and vice-versa.
    - **Focus-Point Alignment (20%):** Maps a focus point 20% down from the top of each viewport to keep the reading/editing area perfectly aligned.
    - **IndexedDB Multi-File Migration:** Replaced the fragile single-file `localStorage` draft system with a scalable IndexedDB solution. This allows users to work on multiple files simultaneously without losing changes when switching between them. Key technical changes include the introduction of `src/utils/storage.js` and the refactoring of `useGitHub.jsx` to prioritize local drafts over redundant network re-fetching.
- **Smooth Zero-Point Transition:** To ensure a clean start, the focus-point offset dynamically scales. At the absolute top (`scrollTop = 0`), the logic uses a 0% offset (Top-to-Top). As you scroll, this offset smoothly interpolates to the full 20% over the first half-viewport of movement. This eliminates "snapping" and ensures both panes always start exactly at the top together.
    - **Boundary-Lock:** Reaching the end of one pane forces the other to its absolute bottom to handle virtual padding differences.
    - **Scroller-Relative Interpolation:** Uses actual scroll positions mapped between the editor and preview scrollers.
    - **Content-End Mapping:** Explicitly maps the "start of text" to "start of text" and "end of text" to "end of text." This ensures that virtual space (like "scroll past end" padding) doesn't interfere with content alignment.
    - **AST-Level Accuracy:** Uses precise character offsets from the Markdown AST to map editor lines to preview elements.
    - **Layout Shift Resilience:** 
        - Employs `ResizeObserver` on the actual `.markdown-body` content element, image `load` listeners, and **CodeMirror geometry update listeners**.
        - **Throttled Forced Updates:** Cache updates are throttled to 16ms (60fps) when forced by layout changes, ensuring synchronization stays accurate even during rapid content shifts (like KaTeX rendering or image loading).
    - **Performance Optimizations:** 
        - **Asynchronous Batching:** Processes element measurements in small batches (100 nodes at a time) with main-thread yielding.
        - **Adaptive Debouncing:** Prevents redundant recalculations during rapid edits.
        - **Scroll-Aware Throttling:** Postpones routine cache updates during active scrolling to avoid layout thrashing, while still allowing **forced geometry-driven updates** to maintain precision.
        - **Paint-Safe Synchronization:** Uses `requestAnimationFrame` with proper cancellation logic to ensure measurements occur after browser layout is stable.
    - **Efficient Implementation:** Uses binary search and scroll-caching for smooth performance even on large documents.
    - **Robust Loop Prevention:** Ref-based locking with a shorter **50ms** lock window ensures scroll events don't trigger infinite feedback loops while remaining responsive.
    - **Active by Default:** Automatically enabled when in split view mode.
- **Independent Scrolling:** Panes scroll independently when not in split view mode.
- **Click-to-Jump (Sync):** Clicking any element in the preview scrolls the editor to the exact character offset of that element.
- **GFM Support:** Support for GitHub Flavored Markdown (Tables, Task lists, Strikethrough, Autolinks).
- **AST Source Mapping:** Custom `remarkOffsetPlugin` injects `data-offset-start` attributes for exact character-to-DOM mapping. List item offsets are now mapped to the very beginning of the line (including bullets and indentation) to ensure a complete selection during click-to-jump.
- **Interactive Links:** Clicking external links (HTTP/HTTPS) in the preview correctly opens them in a new tab with `noopener noreferrer` security. Internal anchors work as expected, and link clicks no longer trigger the editor "click-to-jump" synchronization.
- **Nested List Symbols:** Implemented distinct bullet point and numbering symbols for nested lists in the preview:
    - **Unordered Lists:** Cycles through `disc` (filled circle), `circle` (empty circle), and `square` (filled square).
    - **Ordered Lists:** Cycles through `decimal` (1, 2, 3), `lower-alpha` (a, b, c), and `lower-roman` (i, ii, iii).
    - **Spacing:** Added a slight `margin-top: 0.25rem` to nested lists for better visual separation without excessive vertical gaps.

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
- **File & Folder CRUD:** Create (Files and Folders via `.gitkeep`), Rename, and Delete directly on the remote repository.
- **Optimistic Updates:** Immediate UI feedback for file operations using `pendingOps`.

---

## 4. Local Workspace & File System

### Virtual File System
- **Browser-based Storage:** Full CRUD support for files and folders stored in `localStorage` metadata and IndexedDB.
- **Local Draft:** Default scratchpad area that persists across refreshes.
- **Empty State Fallback:** Displays a dedicated `welcome.md` guide instead of a blank editor when the user first loads the application or deletes their currently active file.

### Native File System Access
- **Local File Import:** Uses `window.showOpenFilePicker` to read files from disk into the workspace.
- **Download:** Export current content as a `.md` file.

---

### Editing & Formatting Features

### Formatting Toolbar
- **Toggleable Formatting:** All formatting actions (Bold, Italic, Strikethrough, Lists, etc.) now support toggling. If the selected text or current line already has the formatting applied, the action will remove it.
- **3-State Toggle (Code/Math):** Code and Math formatting follow a cycle: None → Inline → Block → None. This allows quick switching between inline styles and block styles using the same shortcut or button.
- **Inline Formatting:** Bold, Italic, Strikethrough, Inline Code.
- **Block Formatting:** Heading 1, Heading 2, Blockquote, Code Block, Table, Math Block.
- **List Management:** Bulleted, Numbered (auto-increment), and Task lists.
- **Exclusive List Formatting:** Implementing "smart swap" logic for list types. When applying a list format (e.g., Numbered) to a line that already has a different list format (e.g., Bulleted), the existing prefix is automatically removed before the new one is applied. Toggling the *same* list type still removes the prefix as expected.
- **Contextual Numbering:** Ordered lists now intelligently detect the preceding list item's number. If you change a bulleted item in the middle of an ordered list (e.g., between `1.` and `3.`), it will correctly apply the next logical number (`2.`) and preserve the existing indentation. Works for both single-line and multi-line selections.
- **Emoji Picker:** Categorized popover with hundreds of emojis.
- **Link Pasting:** Automatically formats pasted URLs as Markdown links (`[selected text](url)`) when text is selected in the editor. It intelligently skips this behavior if the selection is already a URL or a Markdown link to prevent double-wrapping.

### Keyboard Shortcuts
- **Global Listener:** `useShortcuts.jsx` maps keys to editor actions.
- **YAML Configuration:** Default shortcuts defined in `shortcuts.yaml`.
- **Platform Normalization:** Automatically maps `mod` to `Cmd` on Mac and `Ctrl` on Windows/Linux.

---

## 6. UI/UX & Quality of Life

### Theme System
- **Dark/Light Mode:** Full UI support for GitHub-style themes.
- **Visual Feedback:** Toast notifications, unsaved changes indicators, and breadcrumbs.
- **Toggleable Tools:** The formatting toolbar and sidebar footer can now be toggled on/off via a dedicated button in the sidebar bottom. This state is managed globally and allows for a more focused, distraction-free writing environment.
- **Visual Edit Highlighting:** The Sidebar now provides immediate visual feedback for files with unsaved changes. An **amber dot indicator** and color shift are applied to any file whose local IndexedDB draft differs from its original baseline. This tracking is path-aware and persists across file switches and app restarts.

### Export & Printing
- **PDF Export:** Optimized `@media print` rules for the preview pane.

### PWA (Progressive Web App)
- **Vite PWA Plugin:** Offline usage support and Service Worker registration.

---

## 8. Recent Fixes & Refinements

- **Vite Build Worker Format Fix:** Resolved a build failure caused by Vite 5's default `iife` worker format being incompatible with code-splitting in the PWA build by explicitly setting `worker: { format: 'es' }` in `vite.config.js`.
- **Inline Image Rendering Fix:** Overrode Tailwind CSS's default `display: block` for `img` elements by setting `.markdown-body img` to `display: inline-block` in `src/index.css`. This ensures consecutive markdown images (such as badges or shields) render side-by-side on the same line rather than breaking onto new lines.
- **Disabled Preview-driven Bottom-Lock:** Removed the bottom-lock functionality in the scroll synchronization when the preview pane is the master scroll source. This prevents the editor from incorrectly jumping to its padded bottom (needed for "scroll past end") when the preview reaches its actual content end.
- **State Management Migration:** Introduced Zustand for centralized state management to eliminate the extreme prop-drilling in the `App.jsx` God Component. State variables like `theme`, `viewMode`, `content`, and `activeFile` are now managed in a centralized store (`src/store/useStore.js`). Setters have been custom-implemented to mimic React's `useState` functional updates (e.g. `prev => new`).
- **Duplicate Key Fix:** Resolved `Encountered two children with the same key` warning in the Sidebar. The key for file list items was changed from `file.sha || file.path` to strictly `file.path`. This prevents collisions when multiple files have the same content (e.g., empty files sharing the same Git SHA `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`).
- **CodeMirror RangeError Fix:** Resolved `Uncaught RangeError: Selection points outside of document` when switching files. The `CodeMirrorEditor` now resets the cursor position to the beginning of the document when content is updated from an external source (like loading a new file), ensuring the previous selection doesn't point past the end of the new content.
- **Editor-Preview Sync Fix:** Resolved an issue where loading a file would update the preview but fail to update the CodeMirror editor. This was caused by a redundant `useEffect` in `CodeMirrorEditor.jsx` that prematurely updated the internal content reference, blocking the external update detection logic.
- **Robust Transaction Handling:** Refined the synchronization between the React `content` state and the CodeMirror `EditorState` to ensure external loads (from GitHub or Local Workspace) correctly trigger a document dispatch while avoiding feedback loops from internal editor changes.
- **Scroll Past End Aware Sync:** Fixed a scroll offset issue that increased towards the end of the document. The synchronization logic now correctly distinguishes between actual content height and the virtual padding added by the "scroll past end" extension.
- **Clamped Precision Sync:** Resolved the "growing layout shift" by implementing a fully normalized content-space coordinate system. All measurements are now relative to the absolute start of the text content (`.markdown-body` and `contentDOM`). Added clamped interpolation ratios and a "bottom-lock" mechanism that forces perfect alignment at the end of the document, ensuring drift never accumulates.
- **Persistent Scroll Shift Fix:** Resolved the "drifting" issue where quick scrolls would cause the editor and preview to become permanently misaligned. This was fixed by:
    1.  Implementing an `onUpdate` listener in `CodeMirrorEditor` that triggers a forced sync map refresh whenever `geometryChanged` or `viewportChanged` occurs (e.g., when CM6 measures new line heights during virtualization).
    2.  Adding a high-priority (16ms) throttled update path in `useSyncScroll` that allows geometry-driven updates to bypass the routine scroll-blocking logic.
    3.  Improving the `requestAnimationFrame` handling with explicit cancellation to ensure the sync map is always built against the latest browser layout state.
- **Simplified Toolbar:** Removed the "sync active/off" toggle button from the top toolbar as it was deemed unnecessary. Scroll synchronization is now always active when the editor and preview are visible in split view.
- **Math Rendering Fix:** Resolved an issue where KaTeX equations were not displaying correctly. The application now correctly imports the `katex.min.css` stylesheet in `index.html`, allowing the `rehype-katex` HTML output to be properly styled and rendered in the preview pane.
- **Toolbar Modified Indicator Fix:** Resolved an issue where the "unsaved changes" orange dot was always visible in the top toolbar, regardless of the file's actual modification state. This was caused by the `Toolbar` component incorrectly shadowing the `isModified` prop with a buggy internal calculation that relied on a non-existent `gme_draft` value in `localStorage`. The component now correctly consumes the `isModified` state calculated by the main application.
- **Removed Flashing 'Saving' Indicator:** Removed the "Saving..." status message from the top toolbar's breadcrumb area. Since save operations are typically very fast, the indicator would flash briefly and cause visual instability. The save button itself still provides a loading spinner for direct feedback during the commit process.
- **Preview-to-Editor Selection Fix:** Resolved an issue where clicking on code blocks or math equations in the preview pane failed to navigate the editor to the corresponding source position. This was fixed by:
    1.  Implementing a `rehypeSyncPlugin` in the Markdown worker that ensures `data-offset-*` attributes are moved from the inner `code` tag to the outer `pre` tag for code blocks.
    2.  Wrapping math elements in a `sync-wrapper` div/span that preserves these attributes before they are replaced by the KaTeX rendering engine.
    3.  Updating the `remarkOffsetPlugin` to explicitly set `hName` and `hProperties` for custom `math` and `inlineMath` node types, ensuring they are correctly carried over during the Remark-to-Rehype conversion.
- **Cross-Repo Filename Conflict Fix:** Resolved an issue where opening a file with the same name (e.g. `README.md`) from different repositories or from the local workspace caused draft collisions and incorrect file highlighting in the sidebar. This was fixed by adding a `repo` attribute to the `activeFile` object in `useGitHub.jsx` and `isLocal: true` to files in `useWorkspace.jsx`, ensuring that storage paths and sidebar active states are resolved uniquely by combining repository context and file path.
- **Preview Syntax Highlighting Fix:** Integrated `rehype-highlight` into the `markdownWorker.js` unified pipeline to ensure that code blocks rendered in the preview pane are correctly syntax-highlighted. We implement dynamic "GitHub" and "GitHub Dark" themes natively in `src/index.css` via CSS variables mapped to the `.dark` Tailwind class, and ensured inner `<code>` elements remain transparent so they rely gracefully on the parent `<pre>` background.
- **Local Workspace Move Confirmation Fix:** Removed the redundant `window.confirm` prompt when dragging and moving files within the local workspace (where `currentRepo` is null). This streamlines the user experience for local file management while preserving the safety check for remote GitHub operations.
- **Manual Repository Entry Removal:** Streamlined the GitHub integration by removing the "Can't see your repo? Enter manually" feature. This involved removing the `manualRepo` state from the `useGitHub` hook, updating `App.jsx` to stop passing these props, and cleaning up the `Sidebar.jsx` UI to focus exclusively on authenticated repository browsing.
- **Dark Mode Editor Header Refinement:** Lightened the highlighting color for Markdown headers (h1, h2, h3) and links in the CodeMirror editor when in dark mode. Updated the color from `#818cf8` (indigo-400) to `#a5b4fc` (indigo-300) to improve legibility against the dark background.
- **Dynamic Highlighting Fix:** Resolved an issue where `darkHighlightStyle` was not being applied correctly in dark mode. The fix involved removing a hardcoded `lightHighlightStyle` from `customBasicSetup` which was overriding the dynamic compartment-based highlighting logic.
- **Table Structural Highlighting:** Implemented a custom CodeMirror `ViewPlugin` (`tableHighlightPlugin`) that dynamically highlights all pipe characters (`|`) whenever consecutive lines share the same number of pipes (n > 0). The highlighting color is theme-aware: `#f9e616` (yellow) in dark mode and `#f97316` (orange) in light mode. Additionally, sequences of dashes (`-`) that appear strictly between two pipes are also highlighted, providing better visual structure for Markdown table separators.
- **Math/KaTeX Structural Highlighting:** Implemented a custom CodeMirror `ViewPlugin` (`mathHighlightPlugin`) for enhanced LaTeX visibility in the editor. 
    - **Delimiters & Symbols:** Highlights `$`, `$$`, and all non-command math content using theme-aware colors (`#f9e616` in dark mode, `#f97316` in light mode).
    - **LaTeX Commands:** Intelligently identifies and highlights LaTeX commands (starting with `\`) using the standard "code" color palette (`#f472b6` in dark mode, `#db2777` in light mode), ensuring clear visual distinction between operators and functions.

---

## 7. Technical Implementation Details

- **Iconography:** Consistent `lucide-react` usage.
- **UTF-8 Safe Base64:** Custom encoding utilities for special character support.
- **Custom Vite Debug Logger:** Intercepts build errors and writes to `debug.log` for agent diagnostics.
