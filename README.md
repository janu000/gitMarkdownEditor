# System Context & Agent Directives

**Project Name:** Git Markdown Editor
**Core Stack:** React 19, Vite, Tailwind CSS, Marked.js, KaTeX.
**Repo Location:** https://github.com/janu000/gitMarkdownEditor/

## CRITICAL AGENT DIRECTIVES

1. **BROWSER LOGS ARE YOUR SOURCE OF TRUTH:** After making *any* code change, or if the user reports an issue/error, you MUST check the live state of the application using your MCP browser tools.
   * *Action:* Use `browser_navigate` to go to `http://host.docker.internal:5173`. Wait for the page to render, and then use `browser_console_get` to retrieve all console logs. 

2. **DOCUMENTATION:** Always update `FEATURES_DEV.md` when making code changes.

3. **ENVIRONMENT LIMITATIONS:** You do not have access to git. You are running in a Docker container.

## Architecture & Technical Context

Git Markdown Editor is a browser-based, client-side-only Markdown editor. It does not have a traditional backend.

* **Entry Point:** `src/main.jsx`

* **Core Application:** `src/App.jsx`

* **Configuration:** `vite.config.js` (contains the PWA config).

* **Styling:** Tailwind utility classes directly in `className` attributes. Global styles in `src/index.css`.

### Key Features

* **Live Preview:** Split-pane rendering of Markdown and KaTeX math.

* **GitHub Sync:** Authenticates via PAT (stored in `localStorage`). Reads/writes directly to the GitHub API.

* **Local File System:** Uses the Browser File System Access API (`window.showOpenFilePicker`) to edit local files.

## State Management & Logic (Custom Hooks)

The application logic is decentralized into specialized custom hooks to keep `App.jsx` focused on orchestration:

* **`useGitHub.jsx`**: Manages all GitHub API interactions, authentication, repository browsing, and remote file operations.
* **`useWorkspace.jsx`**: Handles the local virtual file system stored in `localStorage`.
* **`useMarkdownParser.jsx`**: Manages dynamic loading of Markdown engines (`Unified`/`Marked`) and KaTeX, handles parsing logic, and generates the Table of Contents (TOC).
* **`useLayoutResizer.jsx`**: Contains resizing logic for the sidebar and editor/preview split-pane.
* **`useFormatting.jsx`**: Provides cursor-aware Markdown formatting utilities (bold, italic, lists, etc.).
* **`useShortcuts.jsx`**: Centralizes global keyboard shortcut event listeners and action mapping.

## Project Structure

* `src/`: Application source code.
    * `main.jsx`: Application entry point.
    * `App.jsx`: Main container, orchestrating high-level state and component composition.
    * `components/`: Modular React components (UI).
        * `Editor.jsx`, `Preview.jsx`, `Sidebar.jsx`, `Toolbar.jsx`, `FormattingToolbar.jsx`, `AuthModal.jsx`, `ShortcutModal.jsx`, `Toast.jsx`.
    * `hooks/`: Specialized business logic and state management.
        * `useGitHub.jsx`, `useWorkspace.jsx`, `useMarkdownParser.jsx`, `useLayoutResizer.jsx`, `useFormatting.jsx`, `useShortcuts.jsx`.
    * `utils/`: Pure utility functions.
        * `encoding.js`, `markdown.js`, `emojis.js`, `shortcutManager.js`.
* `public/`: Static assets.
* `vite.config.js`: Vite configuration and PWA setup.
* `FEATURES_DEV.md`: Detailed technical checklist of implemented and planned features.