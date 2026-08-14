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
- **Collapsible Code Blocks & State Persistence:**
    - Integrated interactive fold buttons directly to the left of fenced code block start tags (```` ``` ```` / `~~~`).
    - Buttons are enlarged (1.5rem / 24px) with subtle, theme-aware neutral grey hover highlights for a cleaner editor look.
    - Buttons are hidden (`opacity: 0`) by default and appear smoothly on hover when hovering over the code block opening line or directly to the left of it (and remain visible when collapsed).
    - Clicking the button collapses the body lines and closing fence into a sleek, clickable `... N lines ...` placeholder pill while preserving the opening language indicator.
    - Clicking either the toggle button or the collapsed pill expands the block back to full view.
    - **Session & Refresh Persistence (`codeBlockFoldStorage.js`):** Code block fold states (collapsed vs expanded) are saved to `localStorage` under `gme_codeblock_folds` mapped per-file. Fold states are restored automatically on site refresh and file switching.
    - **Default Collapsed Excalidraw Blocks:** Any fenced ```` ```excalidraw ```` blocks (or `.excalidraw` / `.excalidraw.md` drawing files opened in the raw CodeMirror editor) are automatically kept collapsed initially by default to minimize visual noise, while still allowing the user to expand them and persist their preferred state.
    - Implemented via custom CodeMirror 6 `StateField`, `ViewPlugin`, and transaction annotations, ensuring document AST, drafts, and undo/redo histories remain 100% intact.
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
- **View Modes (Persistent via `localStorage`):**
    - **Edit Mode:** Full-screen editor (`'edit'`).
    - **Split Mode:** Side-by-side editor and preview with a slim 1px separator (`'split'`).
    - **Preview Mode:** Full-screen rendered output (`'preview'`).
    - **Auto-Restoration:** The user's last chosen view mode is saved under `gme_view_mode` in `localStorage` and automatically restored on page refresh or startup.
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
    - **Multi-Engine Support:** Seamless, high-precision synchronization for both **Source Mode (CodeMirror 6)** and **Visual Mode (Milkdown/Crepe ProseMirror WYSIWYG)**.
    - **Dynamic Scroller Discovery & Mode-Switching Resilience:** Integrates a `MutationObserver` on `#editor-container` alongside auto-retry discovery to immediately and seamlessly bind scroll listeners, observers, and anchor caches when toggling between Source (CodeMirror) and Visual (WYSIWYG) modes, ensuring sync scroll never disables or drops across mode transitions.
    - **Semantic Content-Signature Alignment Engine:** Replaces fragile index-based DOM block pairing with a robust forward sliding-window signature matcher. Accurately pairs headings, paragraphs, code blocks, lists, blockquotes, tables, and math equations across `.ProseMirror` and `.markdown-body` by text prefix and tag semantics, completely eliminating drift and offset mismatches caused by internal Crepe widget wrappers or nested lists.
    - **Focus-Point Alignment (20%):** Maps a focus point 20% down from the top of each viewport to keep the reading/editing area perfectly aligned.
    - **IndexedDB Multi-File Migration:** Replaced the fragile single-file `localStorage` draft system with a scalable IndexedDB solution. This allows users to work on multiple files simultaneously without losing changes when switching between them. Key technical changes include the introduction of `src/utils/storage.js` and the refactoring of `useGitHub.jsx` to prioritize local drafts over redundant network re-fetching.
- **Smooth Zero-Point Transition:** To ensure a clean start, the focus-point offset dynamically scales. At the absolute top (`scrollTop = 0`), the logic uses a 0% offset (Top-to-Top). As you scroll, this offset smoothly interpolates to the full 20% over the first half-viewport of movement. This eliminates "snapping" and ensures both panes always start exactly at the top together.
    - **Boundary-Lock:** Reaching the end of one pane forces the other to its absolute bottom to handle virtual padding differences.
    - **Scroller-Relative Interpolation:** Uses actual scroll positions mapped between the editor and preview scrollers.
    - **Content-End Mapping:** Explicitly maps the "start of text" to "start of text" and "end of text" to "end of text." This ensures that virtual space (like "scroll past end" padding) doesn't interfere with content alignment.
    - **AST-Level Accuracy:** Uses precise character offsets from the Markdown AST to map editor lines to preview elements.
    - **Layout Shift Resilience:** 
        - Employs `ResizeObserver` on the actual `.markdown-body` content element, `.ProseMirror` visual document, image `load` listeners, and **CodeMirror geometry update listeners**.
        - **Throttled Forced Updates:** Cache updates are throttled to 16ms (60fps) when forced by layout changes, ensuring synchronization stays accurate even during rapid content shifts (like KaTeX rendering or image loading).
    - **Performance Optimizations:** 
        - **Asynchronous Batching:** Processes element measurements in small batches (100 nodes at a time) with main-thread yielding.
        - **Adaptive Debouncing:** Prevents redundant recalculations during rapid edits.
        - **Scroll-Aware Throttling:** Postpones routine cache updates during active scrolling to avoid layout thrashing, while still allowing **forced geometry-driven updates** to maintain precision.
        - **Paint-Safe Synchronization:** Uses `requestAnimationFrame` with proper cancellation logic to ensure measurements occur after browser layout is stable.
    - **Efficient Implementation:** Uses binary search and scroll-caching for smooth performance even on large documents.
    - **Robust Loop Prevention:** Ref-based locking with a shorter **50ms** lock window ensures scroll events don't trigger infinite feedback loops while remaining responsive.
    - **Active by Default:** Automatically enabled when in split view mode across all editor engines.
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
- **Exclusively Markdown:**
    - The application strictly filters and supports Markdown files (`.md`, `.markdown`, `.mdown`, `.mkdn`, `.mkd`).
    - File creation and renaming enforce valid markdown file structures automatically.
- **Clean Display Names (Hidden File Extensions):**
    - The user interface (Sidebar workspace list, GitHub repository tree, top Toolbar breadcrumbs, modal dialogs, and browser document title) strips `.md` / `.markdown` extensions for a cleaner, note-taking aesthetic while preserving raw filenames under the hood.

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
- **Automatic Explorer Expansion:** The file explorer now automatically expands all parent folders of the currently open file. This ensures that the active file is always visible in the sidebar tree upon initial load (from `localStorage` session restoration) or when switching between files. The expansion logic is path-aware and works seamlessly for both local workspace files and GitHub repository contents.

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
- **Table Structural Highlighting:** Implemented a custom CodeMirror `ViewPlugin` (`tableHighlightPlugin`) for enhanced Markdown table visibility.
    - **Pipes:** Always highlights pipe characters (`|`) in any line containing multiple pipes.
    - **Dashes:** Automatically highlights unbroken sequences of dashes (`---`) when they are encapsulated between two pipes, allowing for optional surrounding whitespace.
    - **Theme Awareness:** Highlighting colors are theme-sensitive: `#f9e616` (yellow) in dark mode and `#059669` (green) in light mode.
- **Math/KaTeX Structural Highlighting:** Implemented a custom CodeMirror `ViewPlugin` (`mathHighlightPlugin`) for enhanced LaTeX visibility in the editor. 
    - **Delimiters & Symbols:** Highlights `$`, `$$`, and all non-command math content using theme-aware colors (`#f9e616` in dark mode, `#f97316` in light mode).
    - **LaTeX Commands:** Intelligently identifies and highlights LaTeX commands (starting with `\`) using the standard "code" color palette (`#f472b6` in dark mode, `#db2777` in light mode), ensuring clear visual distinction between operators and functions.
- **Bottom Bar Height Refinement:** Reduced the height of the entire bottom bar (including the formatting toolbar and sidebar shortcut footer) from `h-10` (40px) to `h-8` (32px). This involved updating `Sidebar.jsx`, `FormattingToolbar.jsx`, and `App.jsx`, along with adjusting internal paddings and icons to ensure a clean, compact layout.
- **Bottom Bar Height Consolidation:** Standardized the bottom bar height management by defining a `--bottom-bar-height` CSS variable in `src/index.css`. All relevant components (`App.jsx`, `FormattingToolbar.jsx`, `Sidebar.jsx`) now consume this variable via Tailwind arbitrary values (`h-[var(--bottom-bar-height)]`), providing a single point of truth for layout adjustments.
- **Document Statistics Bar:** Integrated a theme-aware statistics bar at the bottom of the preview column. It provides real-time word and character counts calculated from the current document content. The bar uses the consolidated `--bottom-bar-height` variable and synchronizes its visibility with the formatting toolbar for a symmetrical, polished interface.
- **Emoji Picker Positioning Fix:** Re-anchored the emoji picker to open above the bottom bar (`bottom-full mb-2`) instead of below it. Also updated its alignment to `right-0` to prevent horizontal clipping in narrow layouts and refined the animation for its new upward-opening direction.
- **Emoji Picker Clipping Fix:** Resolved an issue where the emoji picker was hidden by the toolbar's parent container. By dynamically switching the container's Tailwind class from `overflow-hidden` to `overflow-visible` when the toolbar is active, the picker can now correctly pop out above the bar without being clipped.
- **Top-Aligned Toolbars & Stats:** Relocated the custom Formatting Toolbar and the Document Statistics bar from the bottom of the screen to the top of their respective panes (Editor and Preview), placing them immediately below the main application Toolbar with a borderless design for the statistics bar.
- **Centralized Tools Toggle:** Moved the toggle button for the Formatting Toolbar from the bottom of the sidebar into the main top Toolbar (using the `Type` icon), providing a cleaner, more unified location for layout configuration, while keeping the Shortcuts button persistently visible at the bottom of the sidebar.
- **Comprehensive Linting & React Hooks Cleanup:** Resolved all ESLint and React compiler rules (specifically `react-hooks/set-state-in-effect` and `react-hooks/exhaustive-deps`) across the codebase, ensuring zero errors and zero warnings.
- **Automatic File Extension Appending:** Added `ensureMarkdownExtension` utility in `src/utils/markdown.js`. When creating new files without a valid file extension (such as typing `"my-file-name"`), the application automatically appends `.md` by default (creating `"my-file-name.md"`). Existing extensions like `.txt`, `.markdown`, `.json` are preserved, and folder creation is handled explicitly via dedicated `createFolder` handlers.
- **Custom Item Creation Widget (`CreateItemModal`):** Replaced native browser `prompt(...)` dialogs with a modern, glassmorphic React modal widget (`CreateItemModal.jsx`). Triggered via the sidebar `+` button or the "Create new branch..." option inside the branch selector dropdown, it features clean "File" vs "Folder" toggle switching, real-time file extension previewing (`Creates: my-file-name.md` for files), folder creation without extensions, preset extensions (`.md`, `.txt`), target directory path badges, and keyboard navigation (`Enter`/`Escape`).
- **Seamless Excalidraw Integration:** Full bidirectional support for Excalidraw diagrams across Markdown, WYSIWYG, and standalone drawing documents.
    - **Inline Fenced Block (` ```excalidraw `):** Store diagrams directly in any `.md` file with standard Excalidraw JSON.
    - **Visual Editor (WYSIWYG) Integration:** Automatically intercepts Excalidraw code blocks in Milkdown/Crepe and renders interactive vector snapshot blocks (`ExcalidrawBlock.jsx`). Users can draw, edit, resize, and delete drawings in-place without touching JSON.
    - **Exact Viewport-Matched Rendering:** Rendered SVG diagrams now match the in-place editor box pixel-for-pixel by preserving `appState.scrollX`, `appState.scrollY`, `appState.zoom`, and box `height`. The **Done** button is integrated natively inside the Excalidraw top toolbar via `renderTopRightUI` with a prominent blue theme (`#2563eb`), 36px tool height, 8px rounded corners, and crisp white checkmark/text. Fixed double-click to edit via capture-phase DOM listeners.
    - **True Fullscreen Drawing Modal (`ExcalidrawModal.jsx`):** Fullscreen actions immediately launch the full edge-to-edge 100vw × 100vh canvas without intermediate windowed widgets. Allows distraction-free sketching with full drawing tools, library support, and live sync back to the markdown document.
    - **Dedicated Drawing Files (`.excalidraw` & `.excalidraw.md`):** Complete compatibility with Obsidian vaults and Excalidraw files. Sidebar features custom palette icons for drawing files, with top-bar toggling between Canvas View and Raw Markdown/JSON.
    - **Toolbar Action:** Added "Insert Excalidraw Drawing" button to both the main Formatting Toolbar and Floating Formatting Toolbar.
    - **Performance & Theme Sync:** Lazy-loaded Excalidraw bundles, light/dark theme synchronization, drag-to-resize handles, and event isolation to prevent ProseMirror/CodeMirror key conflicts during drawing.
    - **Full Custom Font Support:** Bundled complete Excalidraw web font assets (`Virgil`, `Cascadia`, `Excalifont`, `Comic Shanns`, `Nunito`, `Assistant`) into `public/fonts` with `window.EXCALIDRAW_ASSET_PATH`, CSS `@font-face` rules, and PWA workbox caching. Text elements inside Excalidraw diagrams now render with their authentic hand-drawn and code typography.
    - **Native Responsive Tooling & Menu Positioning:** Fully restored native Excalidraw responsive layout controls across top/bottom bars, ensuring the 3-line hamburger menu, shapes toolbar, and floating property panels render in their authentic positions without clipping or collision.
    - **Seamless Block Header Alignment:** Overwrote inner canvas container borders and rounded radii (`border-radius: 0; border: none;`), ensuring the drawing surface meets the in-place editor's top header divider line seamlessly without awkward corner gaps or double borders.
- **Visual Editor Fluid Text Layout:**
    - Normal text elements (paragraphs, headings, lists, blockquotes) now span 100% of the editor container width for an unconstrained, modern widescreen note-taking experience.
    - Structural and rich content blocks (Markdown tables, code blocks, images, KaTeX math displays, and Excalidraw diagrams) remain cleanly bounded to `max-width: 56rem` (896px) to preserve optimal reading and tabular layout ergonomics.
- **Visual Editor (WYSIWYG) Search & Replace:**
    - Unified the custom `SearchPanel` modal to work seamlessly across both Source (CodeMirror 6) and Visual (Milkdown/Crepe ProseMirror) editor modes.
    - **ProseMirror Search Engine Plugin:** Integrated a custom ProseMirror plugin (`gmeSearchPlugin`) with dynamic inline decorations (`DecorationSet`), highlighting all matching phrases (`.gme-search-match`) and distinctly highlighting the active match (`.gme-search-match-selected`) across text blocks, headings, lists, tables, and code blocks.
    - **Zero-Flicker Search Performance:** Completely decoupled the Crepe editor instance lifecycle from search query state. Typing in search only dispatches virtual ProseMirror decoration meta transactions without unmounting, destroying, or re-rendering the visual editor instance.
    - **Optimized Zustand Store Selectors:** Implemented `useShallow` across root state consumers to ensure typing in search inputs does not trigger unnecessary parent re-renders in `App.jsx`.
    - **Live Match Counter:** Accurately computes and tracks total matches and current active match index (`N/M`), updating in real-time as the user types, edits text, or clicks inside the document.
    - **Full Navigation & Action Suite:** Supports Find Next (Enter / Down Arrow / F3), Find Previous (Shift+Enter / Up Arrow / Shift+F3), Replace Next, Replace All (atomic transaction), and Undo/Redo forwarding from search inputs.
    - **Smooth Center-Aligned Auto-Scroll:** Automatically scrolls the visual editor viewport to smoothly center the active search match.
    - **Search Filters:** Full support for Case Sensitivity (`Alt+C`), Whole Word (`Alt+W`), and Regular Expressions (`Alt+R`).
- **Persistent Code Block Collapse & Default Excalidraw Folding:**
    - **Persistence across Session & Site Refreshes:** Collapse and expand states for all fenced code blocks in the raw CodeMirror 6 editor are persisted in `localStorage` under `gme_codeblock_folds` using deterministic multi-level keys (primary line content hash, block index, and content signatures) mapped per-file.
    - **Excalidraw Blocks Default to Collapsed:** Fenced ```` ```excalidraw ```` blocks (and `.excalidraw` / `.excalidraw.md` files opened in raw mode) are automatically collapsed on initial load to keep the markdown content clean and scannable.
    - **User Preference Preservation:** When users expand an Excalidraw block or collapse any other code block (JavaScript, Python, etc.), the application records their choice and restores it across site refreshes and file switches.
    - **Clean State Synchronization:** Automatic fold restorations use CodeMirror `Annotation` tokens to prevent race conditions or false saves, while user toggles (via button click, placeholder click, or fold keyboard shortcuts) persist instantly.
- **Custom Delete Confirmation Modal (`DeleteConfirmModal.jsx`):**
    - Replaced disruptive, unstyled native browser `window.confirm` dialogs for file and folder deletions with a bespoke, accessible, glassmorphic modal popup matching the application's design system.
    - **Context-Aware Information:** Displays item type (file vs folder), item name, full item path, and repository/branch or local workspace context badge.
    - **Destructive Action Safety:** Features a danger badge, warning notice about permanent deletion, auto-focus on the `Cancel` action to prevent accidental confirmation, and keyboard navigation support (`Escape` to dismiss, form submission for deletion).
    - **Clean Architecture:** Fully removed native blocking `window.confirm` calls from `App.jsx` and `useGitHub.jsx`, seamlessly delegating user confirmation to the new UI modal.
- **Excalidraw Fullscreen Save & Apply State Synchronization:**
    - Resolved an issue where drawing changes made in fullscreen modal mode were lost upon clicking "Save & Apply".
    - **Direct API Extraction:** `ExcalidrawModal` and `ExcalidrawCanvas` now directly query the live Excalidraw instance API (`api.getSceneElements()`, `api.getAppState()`, `api.getFiles()`) on Save & Apply, eliminating race conditions caused by asynchronous debounced state updates.
    - **Synchronous Markdown Reconciliation:** `RichMarkdownEditor` (`updateDrawing`, `insertDrawing`, `handleBlockChange`) and `useFormatting` (`insertExcalidraw`) now synchronously update `markdownRef.current` and parent `content` immediately upon transaction dispatch.
    - **In-Place Ghost Canvas Prevention:** When expanding an Excalidraw diagram into the fullscreen modal from within an active in-place edit session or hover action, `ExcalidrawBlock` now explicitly resets `isEditing` to `false` and synchronizes its `latestDataRef.current`. This prevents inactive in-place canvas instances from firing stale `onChange` events and reverting the saved drawing.
    - **Flicker-Free In-Place Editing:** Stabilized the in-place `ExcalidrawCanvas` mounting lifecycle with a dedicated edit session key. Prevents React from continuously unmounting and re-mounting the canvas on every stroke during active drawing sessions.
    - **CodeMirror Sync Guard:** Protected `CodeMirrorEditor`'s external sync effect to prevent debounced internal updates from being overwritten by external re-renders when exiting fullscreen modals.
    - **Robust Node Matching:** `updateDrawing` now locates target Excalidraw code blocks by relative position and language attributes with automatic fallback searching, ensuring updates never fail even if node positions shifted.
- **Clean Browser Print to PDF Export:**
    - **Header & Footer White Space + Clean Page Numbering:** Configured `@page { margin: 20mm 16mm; @bottom-center { content: counter(page); font-size: 9pt; color: #6b7280; } @top-left: none; @top-right: none; }` with zeroed container padding in `@media print`. This guarantees uniform 20mm top (header) and bottom (footer) margin breathing room on every page, with clean centered page numbering (`1`, `2`, `3`...) and zero site names or URLs.
    - **Removed Header Filename & Title:** When invoking Export to PDF (`window.print()`), `handleExportPdf` temporarily blanks `document.title = ''`, completely preventing the browser from printing any filename or site title at the top of the page.
    - **Hidden Interface & Status Overlays:** Added `print:hidden` and comprehensive print CSS rules to hide toast notifications (e.g. "Loaded filename"), modals, floating toolbars, Excalidraw hover action bars, block headers, resizers, and sidebars during print.

---

## 7. Technical Implementation Details

- **Iconography:** Consistent `lucide-react` usage.
- **UTF-8 Safe Base64:** Custom encoding utilities for special character support.
- **Custom Vite Debug Logger:** Intercepts build errors and writes to `debug.log` for agent diagnostics.



