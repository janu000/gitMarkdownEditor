# Git Markdown Editor

A highly performant, browser-based, client-side-only Markdown editor with direct GitHub integration.

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

**Git Markdown Editor** is a professional-grade Markdown editing environment built entirely in the browser. It features a robust split-pane live preview, high-precision bi-directional scroll synchronization, and native support for complex formatting like LaTeX math and GitHub Flavored Markdown (GFM). 

What sets this editor apart is its **zero-backend architecture**. It interfaces directly with the GitHub API using Personal Access Tokens (PAT), allowing you to browse repositories, switch branches, create commits, and manage files without any intermediary servers. It also fully supports local offline editing via the Browser File System Access API and robust IndexedDB-based multi-file state persistence.

## Key Features

### 📝 Core Editing Experience
* **Professional Editor Engine:** Powered by **CodeMirror 6**, supporting large documents with thousands of lines smoothly using virtualization.
* **Smart Editing:** Auto-bracket closing, smart indentation, line wrapping, and syntax highlighting.
* **Custom Themes:** Beautiful, unified Light and Dark modes.
* **Robust Keyboard Shortcuts:** Comprehensive global shortcut mapping.

### 🔍 Live Preview & Markdown Engine
* **High-Precision Sync Scrolling:** Bi-directional scroll synchronization between the editor and preview. Keeps your exact reading/editing point perfectly aligned using AST-level character-to-DOM mapping.
* **Off-Thread Parsing:** Markdown parsing is offloaded to a Web Worker to ensure UI responsiveness.
* **Advanced Formatting:** Full support for GitHub Flavored Markdown (Tables, Task lists) and LaTeX math rendering via **KaTeX** (`$inline$` and `$$block$$`).
* **Table of Contents:** Auto-generated TOC from headers for quick document navigation.

### 🐙 Direct GitHub Integration
* **Serverless Architecture:** Authenticate with a standard GitHub PAT.
* **Repository Management:** Browse repositories, view branches, and switch or create new branches directly in the UI.
* **Remote File Operations:** Fetch, edit, commit, and push changes directly back to your GitHub repositories with optimistic UI updates.

### 💾 Local Workspace & Persistence
* **IndexedDB Multi-File Storage:** Automatically saves drafts for all open files via `localforage`. Edit multiple files and switch between them without losing local changes.
* **Native File System Access:** Open and save local `.md` files directly using the modern Web File System API (`window.showOpenFilePicker`).
* **PWA Support:** Installable as a Progressive Web App for offline usage.

## Technology Stack

* **Framework:** React 19 + Vite
* **Styling:** Tailwind CSS
* **Editor:** CodeMirror 6
* **Markdown Parsing:** Unified ecosystem (`remark`, `rehype`) running in a Web Worker
* **Math Rendering:** KaTeX
* **Storage:** `localforage` (IndexedDB)
* **Icons:** Lucide React

## Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/janu000/gitMarkdownEditor.git
   cd gitMarkdownEditor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

### Building for Production

To create an optimized production build:
```bash
npm run build
```
To preview the production build locally:
```bash
npm run preview
```

## Usage Guide

### Connecting to GitHub
1. Open the application.
2. Click the "Authenticate" or GitHub icon in the UI.
3. Enter a standard GitHub Personal Access Token (PAT) with `repo` scope.
4. Your token is stored securely in your browser's `localStorage` and is never sent anywhere except directly to the GitHub API.

### Editing Files
* **Local Drafts:** Any text entered into the workspace is automatically saved every 500ms to IndexedDB.
* **GitHub Repos:** Browse the file tree, select a markdown file, edit it, and use the commit functionality to push changes directly to the remote repository.

### Keyboard Shortcuts
You can view all mapped keyboard commands directly in the application's Shortcuts Modal (usually mapped to `Ctrl + /` or `Cmd + /`).

## Architecture Highlights

Git Markdown Editor utilizes a decentralized custom hook architecture to manage state and complex logic off the main component:
* `useGitHub.jsx`: GitHub API interactions, authentication, and remote file operations.
* `useWorkspace.jsx`: Manages the local virtual file system and active file state.
* `useMarkdownParser.jsx`: Orchestrates the Web Worker parsing lifecycle with adaptive debouncing.
* `useSyncScroll.jsx`: The core engine for precise editor/preview scroll synchronization.
* `useLayoutResizer.jsx`: Handles performant 60fps resizing of the split-pane UI.
* `markdownWorker.js`: The dedicated Web Worker for non-blocking Markdown processing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
