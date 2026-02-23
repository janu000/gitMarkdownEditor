import React, { useState, useEffect, useRef, useCallback, useDeferredValue, useMemo } from 'react';

// ... (rest of imports remains the same)
import { loadShortcuts, matchesShortcut } from './utils/shortcutManager';

// Components
import Toast from './components/Toast';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import FormattingToolbar from './components/FormattingToolbar';
import Editor from './components/Editor';
import Preview from './components/Preview';
import ShortcutModal from './components/ShortcutModal';

// Hooks
import useLayoutResizer from './hooks/useLayoutResizer';
import useMarkdownParser from './hooks/useMarkdownParser';
import useGitHub from './hooks/useGitHub';
import useFormatting from './hooks/useFormatting';
import useShortcuts from './hooks/useShortcuts';
import useWorkspace from './hooks/useWorkspace';

// Safely attempt to load README.md
const readmeFiles = import.meta.glob('../README.md', { query: '?raw', eager: true, import: 'default' });
const defaultContent = Object.keys(readmeFiles).length > 0 ? Object.values(readmeFiles)[0] : null;

const DEFAULT_MARKDOWN = `
# Welcome to Git Markdown Editor

Git Markdown Editor is a powerful, browser-based Markdown editor.

### Features
- **GitHub Integration**: Connect your account and edit files directly from your repos.
- **Local Workspace**: Edit and save files on your local browser storage.
- **Live Preview**: See your changes in real-time.
- **Math Support**: Write equations using KaTeX.

Get started by editing this text or connecting your GitHub account!
`;

export default function App() {
  // --- Refs ---
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const activeFileRef = useRef(null);

  // --- Basic State ---
  const [content, setContent] = useState(() => {
    const savedDraft = localStorage.getItem('gme_draft');
    if (savedDraft) return savedDraft;
    return defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN;
  });
  
  const [theme, setTheme] = useState(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
      return localStorage.getItem('theme');
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  const [viewMode, setViewMode] = useState('split');
  const [loadingState, setLoadingState] = useState('');
  const [toast, setToast] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [shortcuts, setShortcuts] = useState(loadShortcuts());
  const [localFileName, setLocalFileName] = useState('');

  // Use deferred value for expensive operations like parsing
  const deferredContent = useDeferredValue(content);

  // --- Shared State for Hooks ---
  const [activeFile, setActiveFile] = useState(null); 
  const [pendingOps, setPendingOps] = useState({}); 
  const [pathStack, setPathStack] = useState([]); 

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const {
    localWorkspaceFiles, createLocalFile, renameLocalFile, deleteLocalFile, updateLocalFileContent
  } = useWorkspace(showToast);

  // Sync refs and persistence (debounced for performance)
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('gme_draft', content);
    }, 1000);
    return () => clearTimeout(handler);
  }, [content]);

  // --- Hooks ---
  const { 
    sidebarWidth, splitRatio, setSplitRatio, 
    isResizingSidebar, setIsResizingSidebar, 
    isResizingSplit, setIsResizingSplit, 
    isSidebarOpen, setIsSidebarOpen 
  } = useLayoutResizer(editorRef);

  const { 
    parsedHtml, processor, tocHeadings, 
    updateTOC, updatePreview 
  } = useMarkdownParser(showToast, setLoadingState);

  const {
    ghToken, setGhToken, ghUser, setGhUser, repos, setRepos,
    currentRepo, setCurrentRepo, currentRepoRef, repoContents, setRepoContents,
    branches, setBranches, currentBranch, setCurrentBranch, currentBranchRef,
    manualRepo, setManualRepo, hiddenRepos, setHiddenRepos,
    apiRequest, fetchRepos, verifyGitHubToken, fetchRepoContents,
    saveToGitHub, loadFile, renameFile: renameGHFile, deleteFile: deleteGHFile, createFile: createGHFile, loadTOC, createBranch
  } = useGitHub(showToast, setLoadingState, {
    content, setContent, activeFile, setActiveFile, activeFileRef,
    pendingOps, setPendingOps,
    pathStack, setPathStack, updateTOC,
    setShowAuthModal
  });

  const { 
    insertText, insertListItem, insertNumberedList, insertTaskList 
  } = useFormatting(editorRef, setContent);

  const handleExportPdf = useCallback(() => window.print(), []);

  const actions = useMemo(() => ({
    saveToGitHub, handleExportPdf, 
    insertText, insertListItem, insertNumberedList, insertTaskList
  }), [saveToGitHub, handleExportPdf, insertText, insertListItem, insertNumberedList, insertTaskList]);

  const handleExportPdfCallback = useCallback(() => handleExportPdf(), [handleExportPdf]);

  useShortcuts(shortcuts, actions);

  // --- Effects ---
  useEffect(() => {
    updatePreview(deferredContent);
    if (pathStack.length > 0 && pathStack[pathStack.length - 1].isTOC && activeFile) {
      if (pathStack[pathStack.length - 1].path === activeFile.path) {
        updateTOC(deferredContent, activeFile.path);
      }
    }
  }, [deferredContent, updatePreview, pathStack, activeFile, updateTOC]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // --- Unified File Operations ---
  const handleSave = useCallback(async () => {
    if (currentRepo) {
      await saveToGitHub();
    } else if (activeFile) {
      updateLocalFileContent(activeFile.path, content);
      showToast('Saved locally');
    }
  }, [currentRepo, activeFile, content, saveToGitHub, updateLocalFileContent, showToast]);

  const handleCreateFile = useCallback(async (name, initialContent = '') => {
    if (currentRepo) {
      await createGHFile(name, initialContent);
    } else {
      const newFile = createLocalFile(name, initialContent);
      if (newFile) {
        setActiveFile(newFile);
        setContent(initialContent);
      }
    }
  }, [currentRepo, createGHFile, createLocalFile, setContent]);

  const handleRenameFile = useCallback(async (file) => {
    if (currentRepo) {
      await renameGHFile(file);
    } else {
      const newName = prompt(`Rename ${file.name} to:`, file.name);
      if (newName && renameLocalFile(file, newName)) {
        if (activeFile?.path === file.path) {
          setActiveFile(prev => ({ ...prev, name: newName, path: newName }));
        }
      }
    }
  }, [currentRepo, renameGHFile, renameLocalFile, activeFile]);

  const handleDeleteFile = useCallback(async (file) => {
    if (currentRepo) {
      await deleteGHFile(file);
    } else {
      if (window.confirm(`Delete ${file.name}?`)) {
        deleteLocalFile(file);
        if (activeFile?.path === file.path) {
          setActiveFile(null);
          setContent('');
        }
      }
    }
  }, [currentRepo, deleteGHFile, deleteLocalFile, activeFile, setContent]);

  // --- Helper Functions ---
  const getWorkspaceFiles = useCallback(() => {
    if (pathStack.length > 0 && pathStack[pathStack.length - 1].isTOC) return tocHeadings;
    if (currentRepo) {
      let files = repoContents.filter(f => {
        const op = pendingOps[f.path];
        if (!op) return true;
        return op.action !== 'delete' && op.action !== 'add';
      });
      const pendingAdds = Object.values(pendingOps).filter(op => op.action === 'add' && op.file).map(op => ({ ...op.file, status: 'pending' }));
      files = [...files, ...pendingAdds];
      return files.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
    } else {
      return localWorkspaceFiles.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
    }
  }, [pathStack, tocHeadings, currentRepo, repoContents, pendingOps, localWorkspaceFiles]);

  const handleDownload = () => {
    const fileName = activeFile?.name || localFileName || 'untitled.md';
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${fileName}`);
  };

  const jumpToLine = useCallback((line) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(line, lines.length); i++) {
        offset += lines[i].length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(offset, offset);
    const lineHeight = 24; 
    textarea.scrollTop = line * lineHeight - (textarea.clientHeight / 2);
  }, [content]);

  const jumpToOffset = useCallback((start, end) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.focus();
    requestAnimationFrame(() => {
      textarea.setSelectionRange(start, end);
    });
  }, []);

  const handlePreviewClick = useCallback((e) => {
    let target = e.target;
    while (target && target !== e.currentTarget) {
      const start = target.getAttribute('data-offset-start');
      const end = target.getAttribute('data-offset-end');
      if (start !== null && end !== null) {
        e.preventDefault();
        e.stopPropagation();
        const s = parseInt(start, 10);
        const e_offset = parseInt(end, 10);
        if (!isNaN(s) && !isNaN(e_offset)) {
          jumpToOffset(s, e_offset);
        }
        return;
      }
      target = target.parentElement;
    }
  }, [jumpToOffset]);

  const importLocalFile = async () => {
    if (!('showOpenFilePicker' in window)) {
      showToast('Browser not supported for direct file access.', 'error');
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md', '.markdown', '.mdx', '.txt'] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      handleCreateFile(file.name, text);
    } catch (_error) {
      if (_error.name !== 'AbortError') showToast('Failed to open local file', 'error');
    }
  };

  const handleScroll = (e) => {
    if (viewMode !== 'split') return;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);
    if (e.target === editorRef.current && previewRef.current) {
      previewRef.current.scrollTop = scrollRatio * (previewRef.current.scrollHeight - previewRef.current.clientHeight);
    } else if (e.target === previewRef.current && editorRef.current) {
      editorRef.current.scrollTop = scrollRatio * (editorRef.current.scrollHeight - editorRef.current.clientHeight);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      {toast && <Toast type={toast.type} message={toast.message} />}

      <AuthModal 
        showAuthModal={showAuthModal} 
        setShowAuthModal={setShowAuthModal} 
        verifyGitHubToken={verifyGitHubToken} 
        loadingState={loadingState} 
      />

      <ShortcutModal
        show={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
        onShortcutsUpdated={setShortcuts}
      />

      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        sidebarWidth={sidebarWidth}
        ghUser={ghUser}
        setShowAuthModal={setShowAuthModal}
        setShowShortcutModal={setShowShortcutModal}
        importLocalFile={importLocalFile}
        createFile={handleCreateFile}
        getWorkspaceFiles={getWorkspaceFiles}
        loadFile={loadFile}
        activeFile={activeFile}
        renameFile={handleRenameFile}
        deleteFile={handleDeleteFile}
        setGhToken={setGhToken}
        setGhUser={setGhUser}
        currentRepo={currentRepo}
        repos={repos}
        loadingState={loadingState}
        hiddenRepos={hiddenRepos}
        setHiddenRepos={setHiddenRepos}
        fetchRepoContents={fetchRepoContents}
        manualRepo={manualRepo}
        setManualRepo={setManualRepo}
        pathStack={pathStack}
        setPathStack={setPathStack}
        setCurrentRepo={setCurrentRepo}
        branches={branches}
        currentBranch={currentBranch}
        setCurrentBranch={setCurrentBranch}
        createBranch={createBranch}
        loadTOC={loadTOC}
        jumpToLine={jumpToLine}
      />

      {isSidebarOpen && (
        <div 
          id="sidebar-resizer" 
          className="w-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group" 
          onMouseDown={() => { setIsResizingSidebar(true); document.body.style.cursor = 'col-resize'; }}
        >
          <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity group-hover:bg-white" />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Toolbar 
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeFile={activeFile}
          currentRepo={currentRepo}
          currentBranch={currentBranch}
          content={content}
          localFileName={localFileName}
          theme={theme}
          setTheme={setTheme}
          viewMode={viewMode}
          setViewMode={setViewMode}
          handleDownload={handleDownload}
          handleExportPdf={handleExportPdfCallback}
          saveToGitHub={handleSave}
          loadingState={loadingState}
          shortcuts={shortcuts}
          isUnified={!!processor}
        />

        <FormattingToolbar 
          viewMode={viewMode}
          insertText={insertText}
          insertListItem={insertListItem}
          insertNumberedList={insertNumberedList}
          insertTaskList={insertTaskList}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          emojiPickerRef={emojiPickerRef}
          shortcuts={shortcuts}
        />

        <div className="flex-1 flex overflow-hidden relative">
          <Editor 
            viewMode={viewMode}
            splitRatio={splitRatio}
            editorRef={editorRef}
            content={content}
            setContent={setContent}
            handleScroll={handleScroll}
          />

          {viewMode === 'split' && (
            <div 
              id="split-resizer" 
              className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group" 
              onMouseDown={() => { setIsResizingSplit(true); document.body.style.cursor = 'col-resize'; }}
            >
              <div className="h-8 w-0.5 bg-gray-400 dark:bg-gray-600 rounded group-hover:bg-white transition-colors" />
            </div>
          )}

          <Preview 
            viewMode={viewMode}
            splitRatio={splitRatio}
            previewRef={previewRef}
            handleScroll={handleScroll}
            parsedHtml={parsedHtml}
            onClick={handlePreviewClick}
          />
        </div>
      </div>
    </div>
  );
}
