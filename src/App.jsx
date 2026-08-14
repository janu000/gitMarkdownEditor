import React, { Suspense, lazy, useEffect, useRef, useCallback, useDeferredValue, useMemo, useState } from 'react';

// Components
import Toast from './components/Toast';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import FormattingToolbar from './components/FormattingToolbar';
import FloatingFormattingToolbar from './components/FloatingFormattingToolbar';
import { EditorView } from 'codemirror';
import { Code2, Highlighter, PenLine } from 'lucide-react';
import CodeMirrorEditor from './components/CodeMirrorEditor';
import Preview from './components/Preview';
import ShortcutModal from './components/ShortcutModal';
import SearchPanel from './components/SearchPanel';

// Hooks
import useStore, { defaultContent, DEFAULT_MARKDOWN } from './store/useStore';
import { useShallow } from 'zustand/react/shallow';
import useLayoutResizer from './hooks/useLayoutResizer';
import useMarkdownParser from './hooks/useMarkdownParser';
import useGitHub from './hooks/useGitHub';
import useFormatting from './hooks/useFormatting';
import useShortcuts from './hooks/useShortcuts';
import useWorkspace from './hooks/useWorkspace';
import useSyncScroll from './hooks/useSyncScroll';
import { storage } from './utils/storage';
import { ensureMarkdownExtension, isMarkdownFile, getDisplayName } from './utils/markdown';
import { 
  isExcalidrawFile, 
  parseExcalidrawContent, 
  serializeToCodeBlock, 
  serializeToObsidianDoc 
} from './utils/excalidraw';

const RichMarkdownEditor = lazy(() => import('./components/RichMarkdownEditor'));
const ExcalidrawModal = lazy(() => import('./components/ExcalidrawModal'));
const ExcalidrawCanvas = lazy(() => import('./components/ExcalidrawCanvas'));

export default function App() {
  // --- Refs ---
  const editorRef = useRef(null);
  const richEditorRef = useRef(null);
  const previewRef = useRef(null);
  const mainAreaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const activeFileRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState(null);

  // --- State from Store ---
  const {
    content, setContent,
    theme, setTheme,
    viewMode, setViewMode,
    editorMode, setEditorMode,
    syntaxHighlighting,
    loadingState, setLoadingState,
    toast, showToast,
    showAuthModal, setShowAuthModal,
    showShortcutModal, setShowShortcutModal,
    showEmojiPicker, setShowEmojiPicker,
    showFormattingTools, setShowFormattingTools,
    shortcuts, setShortcuts,
    localFileName,
    activeFile, setActiveFile,
    pendingOps, setPendingOps,
    pathStack, setPathStack,
    expandedPaths, setExpandedPaths,
    modifiedFiles, setModifiedFiles,
    setSearchVisible, setReplaceVisible
  } = useStore(useShallow(state => ({
    content: state.content,
    setContent: state.setContent,
    theme: state.theme,
    setTheme: state.setTheme,
    viewMode: state.viewMode,
    setViewMode: state.setViewMode,
    editorMode: state.editorMode,
    setEditorMode: state.setEditorMode,
    syntaxHighlighting: state.syntaxHighlighting,
    loadingState: state.loadingState,
    setLoadingState: state.setLoadingState,
    toast: state.toast,
    showToast: state.showToast,
    showAuthModal: state.showAuthModal,
    setShowAuthModal: state.setShowAuthModal,
    showShortcutModal: state.showShortcutModal,
    setShowShortcutModal: state.setShowShortcutModal,
    showEmojiPicker: state.showEmojiPicker,
    setShowEmojiPicker: state.setShowEmojiPicker,
    showFormattingTools: state.showFormattingTools,
    setShowFormattingTools: state.setShowFormattingTools,
    shortcuts: state.shortcuts,
    setShortcuts: state.setShortcuts,
    localFileName: state.localFileName,
    activeFile: state.activeFile,
    setActiveFile: state.setActiveFile,
    pendingOps: state.pendingOps,
    setPendingOps: state.setPendingOps,
    pathStack: state.pathStack,
    setPathStack: state.setPathStack,
    expandedPaths: state.expandedPaths,
    setExpandedPaths: state.setExpandedPaths,
    modifiedFiles: state.modifiedFiles,
    setModifiedFiles: state.setModifiedFiles,
    setSearchVisible: state.setSearchVisible,
    setReplaceVisible: state.setReplaceVisible,
  })));

  // Automatically expand parent folders of active file
  useEffect(() => {
    if (activeFile && activeFile.path) {
      const parts = activeFile.path.split('/');
      if (parts.length > 1) {
        setExpandedPaths(prev => {
          const next = new Set(prev);
          let currentPath = '';
          let changed = false;
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            if (!next.has(currentPath)) {
              next.add(currentPath);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    }
  }, [activeFile, setExpandedPaths]);

  // Use deferred value for expensive operations like parsing
  const deferredContent = useDeferredValue(content);

  const {
    localWorkspaceFiles, createLocalFile, createLocalFolder, renameLocalFile, deleteLocalFile, moveLocalFile, updateLocalFileContent
  } = useWorkspace(showToast);

  // Sync refs (debounced for performance)
  useEffect(() => { 
    activeFileRef.current = activeFile; 
  }, [activeFile]);
  
  // --- Hooks ---
  const { 
    sidebarWidth, tempSplitRatio, 
    isResizingSidebar, setIsResizingSidebar, 
    isResizingSplit, setIsResizingSplit, 
    isSidebarOpen, setIsSidebarOpen 
  } = useLayoutResizer(mainAreaRef);

  const { 
    parsedHtml, tocHeadings, isExpensive,
    updateTOC, updatePreview 
  } = useMarkdownParser(showToast, setLoadingState);

  const {
    setGhToken, ghUser, setGhUser, repos,
    currentRepo, setCurrentRepo, repoContents,
    branches, currentBranch, setCurrentBranch, setBranches,
    hiddenRepos, setHiddenRepos,
    verifyGitHubToken, fetchRepoContents,
    saveToGitHub, loadFile, renameFile: renameGHFile, moveFile: moveGHFile, deleteFile: deleteGHFile, createFile: createGHFile, createFolder: createGHFolder, loadTOC, createBranch
  } = useGitHub(showToast, setLoadingState, {
    content, setContent, defaultContent: defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN,
    activeFile, setActiveFile, activeFileRef,
    pendingOps, setPendingOps,
    pathStack, setPathStack, updateTOC,
    setShowAuthModal
  });

  // Restore session on mount
  useEffect(() => {
    const savedActiveFile = localStorage.getItem('gme_last_active_file');
    if (savedActiveFile) {
      const file = JSON.parse(savedActiveFile);
      loadFile(file);
    }
  }, [loadFile]); // Only once on mount

  // Per-file Auto-save to IndexedDB & Modified State Tracking
  useEffect(() => {
    if (!activeFile) return;

    const handler = setTimeout(async () => {
      const storagePath = activeFile.repo 
        ? `${activeFile.repo}/${activeFile.branch || currentBranch}/${activeFile.path}` 
        : `local/${activeFile.path}`;
      
      await storage.saveDraft(storagePath, content);

      // Check if modified compared to original
      const original = await storage.getOriginal(storagePath);
      if (original !== null && original !== content) {
        setModifiedFiles(prev => {
          if (prev.has(storagePath)) return prev;
          const next = new Set(prev);
          next.add(storagePath);
          return next;
        });
      } else {
        setModifiedFiles(prev => {
          if (!prev.has(storagePath)) return prev;
          const next = new Set(prev);
          next.delete(storagePath);
          return next;
        });
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [content, activeFile, currentRepo, currentBranch, setModifiedFiles]);

  const { 
    insertText, insertListItem, insertNumberedList, insertTaskList,
    setBlockType, undoChange, redoChange, toggleCode, toggleMath, insertExcalidraw
  } = useFormatting(editorRef);

  // Synchronize document window title with active file display name
  useEffect(() => {
    if (activeFile) {
      document.title = `${getDisplayName(activeFile.name)} - Git Markdown Editor`;
    } else if (localFileName) {
      document.title = `${getDisplayName(localFileName)} - Git Markdown Editor`;
    } else {
      document.title = 'Git Markdown Editor';
    }
  }, [activeFile, localFileName]);

  const [excalidrawModalState, setExcalidrawModalState] = useState({
    isOpen: false,
    initialData: null,
    rawCode: null,
    offsetStart: null,
    offsetEnd: null,
  });

  const [standaloneCanvasView, setStandaloneCanvasView] = useState('canvas'); // 'canvas' | 'raw'

  const runFormattingCommand = useCallback((visualCommand, sourceCommand) => {
    if (editorMode === 'visual') {
      richEditorRef.current?.[visualCommand]?.();
      return;
    }
    sourceCommand();
  }, [editorMode]);

  const handleOpenExcalidrawModal = useCallback((data, rawCode = null, offsetStart = null, offsetEnd = null) => {
    setExcalidrawModalState({
      isOpen: true,
      initialData: data || null,
      rawCode: rawCode || null,
      offsetStart: offsetStart != null ? parseInt(offsetStart, 10) : null,
      offsetEnd: offsetEnd != null ? parseInt(offsetEnd, 10) : null,
    });
  }, []);

  const handleSaveExcalidrawModal = useCallback((updatedData) => {
    const { rawCode, offsetStart, offsetEnd } = excalidrawModalState;
    const newCodeBlock = serializeToCodeBlock(updatedData);

    // Standalone .excalidraw or .excalidraw.md active file
    if (activeFile && isExcalidrawFile(activeFile.name)) {
      const formatted = activeFile.name.endsWith('.excalidraw')
        ? JSON.stringify(updatedData, null, 2)
        : serializeToObsidianDoc(updatedData);
      setContent(formatted);
      return;
    }

    // Direct update inside visual WYSIWYG editor
    if (editorMode === 'visual' && typeof offsetStart === 'number') {
      const updated = richEditorRef.current?.updateDrawing?.(offsetStart, updatedData);
      if (updated) return;
    }

    // Replace matched rawCode in content
    if (rawCode && content.includes(rawCode)) {
      const newJson = JSON.stringify(updatedData, null, 2);
      setContent((prev) => prev.replace(rawCode, newJson));
      return;
    }

    // Replace by offset coordinates
    if (offsetStart != null && offsetEnd != null && offsetEnd >= offsetStart) {
      setContent((prev) => prev.slice(0, offsetStart) + newCodeBlock + prev.slice(offsetEnd));
      return;
    }

    // Insert new drawing at cursor
    if (editorMode === 'visual') {
      richEditorRef.current?.insertDrawing?.(updatedData);
    } else {
      insertExcalidraw(updatedData);
    }
  }, [excalidrawModalState, activeFile, content, editorMode, insertExcalidraw, setContent]);

  const formattingActions = useMemo(() => ({
    insertText: (before, after = '', defaultText = '') => {
      const visualCommands = {
        '**': 'bold',
        '*': 'italic',
        '~~': 'strikethrough',
        '# ': 'heading',
        '## ': 'heading',
        '> ': 'quote',
        '[': 'link',
        '![alt text](': 'image',
      };
      const command = visualCommands[before];
      if (editorMode === 'visual' && command) {
        if (command === 'heading') richEditorRef.current?.heading(before === '# ' ? 1 : 2);
        else richEditorRef.current?.[command]?.();
        return;
      }
      if (editorMode === 'visual') {
        richEditorRef.current?.insertText(before + defaultText + after);
        return;
      }
      insertText(before, after, defaultText);
    },
    insertListItem: (prefix, defaultText) => runFormattingCommand('bulletList', () => insertListItem(prefix, defaultText)),
    insertNumberedList: (startNumber, defaultText) => runFormattingCommand('numberedList', () => insertNumberedList(startNumber, defaultText)),
    insertTaskList: (prefix, defaultText) => runFormattingCommand('taskList', () => insertTaskList(prefix, defaultText)),
    setBlockType: (level) => runFormattingCommand('setBlockType', () => setBlockType(level)),
    insertTable: () => runFormattingCommand('insertTable', () => insertText(`
  | Header 1 | Header 2 |
  | -------- | -------- |
  | Cell 1   | Cell 2   |
  `, '', '')),
    toggleCode: () => runFormattingCommand('code', () => toggleCode()),
    insertCodeBlock: () => runFormattingCommand('codeBlock', () => toggleCode()),
    toggleMath: () => runFormattingCommand('math', () => toggleMath()),
    insertDrawing: () => {
      if (editorMode === 'visual') {
        richEditorRef.current?.insertDrawing?.();
      } else {
        insertExcalidraw();
      }
    },
    undo: () => runFormattingCommand('undo', undoChange),
    redo: () => runFormattingCommand('redo', redoChange),
  }), [editorMode, insertListItem, insertNumberedList, insertTaskList, insertText, insertExcalidraw, redoChange, runFormattingCommand, setBlockType, toggleCode, toggleMath, undoChange]);

  const handleExportPdf = useCallback(() => window.print(), []);

  const actions = useMemo(() => ({
    saveToGitHub, handleExportPdf, 
    ...formattingActions,
    setSearchVisible, setReplaceVisible
  }), [saveToGitHub, handleExportPdf, formattingActions, setSearchVisible, setReplaceVisible]);

  const handleExportPdfCallback = useCallback(() => handleExportPdf(), [handleExportPdf]);

  useShortcuts(shortcuts, actions);
  const triggerSyncUpdate = useSyncScroll(editorRef, richEditorRef, previewRef, editorMode, viewMode === 'split', parsedHtml);

  const stats = useMemo(() => {
    const text = content || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    return { words, chars };
  }, [content]);

  // --- Effects ---
  useEffect(() => {
    // Adaptive Debounce based on parsing complexity
    const delay = isExpensive ? 300 : 0;
    
    if (delay === 0) {
      updatePreview(deferredContent, activeFile?.path);
      return;
    }

    const handler = setTimeout(() => {
      updatePreview(deferredContent, activeFile?.path);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [deferredContent, updatePreview, activeFile, isExpensive]);

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
  }, [showEmojiPicker, setShowEmojiPicker]);

  // --- Unified File Operations ---
  const handleSave = useCallback(async () => {
    if (currentRepo) {
      await saveToGitHub();
    } else if (activeFile) {
      await updateLocalFileContent(activeFile.path, content);
      showToast('Saved locally');
    }
  }, [currentRepo, activeFile, content, saveToGitHub, updateLocalFileContent, showToast]);

  const handleCreateFile = useCallback(async (name, initialContent = '', parentPath = null) => {
    if (!name) return;
    const formattedName = ensureMarkdownExtension(name);

    if (currentRepo) {
      await createGHFile(formattedName, initialContent, parentPath);
    } else {
      const currentPath = parentPath !== null ? parentPath : (pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '');
      const newFile = await createLocalFile(formattedName, currentPath, initialContent);
      if (newFile) {
        setActiveFile(newFile);
        setContent(initialContent);
      }
    }
  }, [currentRepo, createGHFile, createLocalFile, setContent, pathStack, setActiveFile]);

  const handleCreateFolder = useCallback(async (name, parentPath = null) => {
    if (!name) return;

    if (currentRepo) {
      await createGHFolder(name, parentPath);
    } else {
      const currentPath = parentPath !== null ? parentPath : (pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '');
      await createLocalFolder(name, currentPath);
    }
  }, [currentRepo, createGHFolder, createLocalFolder, pathStack]);

  const handleRenameFile = useCallback(async (file, customNewName = null) => {
    if (currentRepo) {
      await renameGHFile(file, customNewName);
    } else {
      const newName = customNewName !== null ? customNewName : prompt(`Rename ${file.name} to:`, file.name);
      if (newName && (await renameLocalFile(file, newName))) {
        if (file.type === 'dir' && activeFile?.path.startsWith(`${file.path}/`)) {
          const pathParts = file.path.split('/');
          pathParts.pop();
          const basePath = pathParts.join('/');
          const newDirPath = basePath ? `${basePath}/${newName}` : newName;
          const newActivePath = activeFile.path.replace(`${file.path}/`, `${newDirPath}/`);
          setActiveFile(prev => ({ ...prev, path: newActivePath }));
        } else if (activeFile?.path === file.path) {
          setActiveFile(prev => ({ ...prev, name: newName, path: newName }));
        }
      }
    }
  }, [currentRepo, renameGHFile, renameLocalFile, activeFile, setActiveFile]);

  const handleDeleteFile = useCallback(async (file) => {
    if (currentRepo) {
      await deleteGHFile(file);
    } else {
      if (window.confirm(`Delete ${file.name}?`)) {
        await deleteLocalFile(file);
        if (file.type === 'dir' && activeFile?.path.startsWith(`${file.path}/`)) {
          setActiveFile(null);
          setContent(defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN);
        } else if (activeFile?.path === file.path) {
          setActiveFile(null);
          setContent(defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN);
        }
      }
    }
  }, [currentRepo, deleteGHFile, deleteLocalFile, activeFile, setContent, setActiveFile]);

  const handleMoveFile = useCallback(async (file, targetPath) => {
    if (currentRepo) {
      // Use useGitHub's moveFile
      await moveGHFile(file, targetPath);
    } else {
      // Use useWorkspace's moveLocalFile
      const success = await moveLocalFile(file, targetPath);
      if (success && activeFile?.path === file.path) {
        const newPath = targetPath ? `${targetPath}/${file.name}` : file.name;
        setActiveFile(prev => ({ ...prev, path: newPath }));
      }
    }
  }, [currentRepo, moveGHFile, moveLocalFile, activeFile, setActiveFile]);

  // Helper to get depth of a path
  const getDepth = (path) => path === '' ? 0 : path.split('/').length;

  const getWorkspaceFiles = useCallback(() => {
    if (pathStack.length > 0 && pathStack[pathStack.length - 1].isTOC) return tocHeadings;
    
    const isExpanded = (path) => expandedPaths.has(path);
    
    if (currentRepo) {
      let allFiles = repoContents.filter(f => {
        const op = pendingOps[f.path];
        if (!op) return true;
        return op.action !== 'delete' && op.action !== 'add';
      });
      const pendingAdds = Object.values(pendingOps).filter(op => op.action === 'add' && op.file).map(op => ({ ...op.file, status: 'pending' }));
      allFiles = [...allFiles, ...pendingAdds];

      // Sort all files by path to make it easier to build the tree
      allFiles.sort((a, b) => a.path.localeCompare(b.path));

      const visibleFiles = [];
      const processLevel = (parentPath = '') => {
        const children = allFiles.filter(f => {
          if (parentPath === '') return !f.path.includes('/');
          const parts = f.path.split('/');
          const parentParts = parentPath.split('/');
          return f.path.startsWith(parentPath + '/') && parts.length === parentParts.length + 1;
        }).sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'dir' ? -1 : 1;
        });

        for (const child of children) {
          visibleFiles.push({ ...child, depth: getDepth(child.path) - 1 });
          if (child.type === 'dir' && isExpanded(child.path)) {
            processLevel(child.path);
          }
        }
      };

      processLevel('');
      return visibleFiles;
    } else {
      const allFiles = localWorkspaceFiles;
      const visibleFiles = [];
      
      const processLevel = (parentPath = '') => {
        const children = allFiles.filter(f => {
          if (parentPath === '') return !f.path.includes('/');
          const parts = f.path.split('/');
          const parentParts = parentPath.split('/');
          return f.path.startsWith(parentPath + '/') && parts.length === parentParts.length + 1;
        }).sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'dir' ? -1 : 1;
        });

        for (const child of children) {
          visibleFiles.push({ ...child, depth: getDepth(child.path) - 1 });
          if (child.type === 'dir' && isExpanded(child.path)) {
            processLevel(child.path);
          }
        }
      };

      processLevel('');
      return visibleFiles;
    }
  }, [currentRepo, repoContents, localWorkspaceFiles, pendingOps, pathStack, tocHeadings, expandedPaths]);

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

  const handleRefreshRepo = useCallback(async () => {
    if (!currentRepo) return;

    // Check if any files in THIS repo AND current branch are modified
    const currentRepoBranchPrefix = `${currentRepo}/${currentBranch}/`;
    const repoModified = Array.from(modifiedFiles).some(path => path.startsWith(currentRepoBranchPrefix));

    if (repoModified) {
      if (!window.confirm(`Discard all local changes in ${currentRepo} on branch ${currentBranch} and refresh from GitHub?`)) {
        return;
      }
      
      // Clear all drafts/originals for this repo/branch in storage
      await storage.clearRepo(`${currentRepo}/${currentBranch}`);

      // Remove from modifiedFiles state
      setModifiedFiles(prev => {
        const next = new Set(prev);
        for (const path of next) {
          if (path.startsWith(currentRepoBranchPrefix)) {
            next.delete(path);
          }
        }
        return next;
      });

      // If the active file belongs to this repo/branch, force-re-fetch its content too
      if (activeFile && activeFileRef.current && activeFileRef.current.repo === currentRepo && (activeFileRef.current.branch || currentBranch) === currentBranch) {
        loadFile(activeFileRef.current, true); // true = forceFresh/bypass cache
      }
      
      showToast('Discarded local changes');
    }

    const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
    // Passing true as the 4th argument (forceRefreshBranches)
    fetchRepoContents(currentRepo, currentPath, null, true);
  }, [currentRepo, currentBranch, modifiedFiles, setModifiedFiles, activeFile, loadFile, pathStack, fetchRepoContents, showToast]);

  const handleDiscardChanges = useCallback(async () => {
    if (!activeFile) {
      if (window.confirm('Reset scratchpad to default?')) {
        setContent(defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN);
        showToast('Scratchpad reset');
      }
      return;
    }
    if (!window.confirm('Discard all unsaved changes to this file?')) return;

    const storagePath = activeFile.repo
      ? `${activeFile.repo}/${activeFile.branch || currentBranch}/${activeFile.path}`
      : `local/${activeFile.path}`;    
    const original = await storage.getOriginal(storagePath);
    if (original !== null) {
      setContent(original);
      await storage.saveDraft(storagePath, original);
      setModifiedFiles(prev => {
        const next = new Set(prev);
        next.delete(storagePath);
        return next;
      });
      showToast('Changes discarded');
    } else {
      showToast('No baseline found to revert to', 'error');
    }
  }, [activeFile, currentBranch, setContent, setModifiedFiles, showToast]);

  const isModified = useMemo(() => {
    if (!activeFile) {
      // For the scratchpad, we check if content differs from default
      return content !== (defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN);
    }
    
    // Local files are always "up to date" in the context of this app's UI
    if (!activeFile.repo) return false;

    const storagePath = `${activeFile.repo}/${activeFile.branch || currentBranch}/${activeFile.path}`;
    return modifiedFiles.has(storagePath);
  }, [activeFile, currentBranch, modifiedFiles, content]);

  const jumpTo = useCallback(({ line, offset, endOffset }) => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    let target;
    if (line !== undefined) {
      const linePos = view.state.doc.line(Math.min(line + 1, view.state.doc.lines));
      target = { anchor: linePos.from };
    } else if (offset !== undefined) {
      target = { anchor: offset, head: endOffset ?? offset };
    }

    if (target) {
      view.dispatch({
        selection: target,
        scrollIntoView: true
      });
      view.focus();
    }
  }, []);

  const handlePreviewClick = useCallback((e) => {
    let target = e.target;
    let isLink = false;
    let linkElement = null;

    // Check if we clicked a link or inside a link
    let temp = target;
    while (temp && temp !== e.currentTarget) {
      if (temp.tagName === 'A') {
        isLink = true;
        linkElement = temp;
        break;
      }
      temp = temp.parentElement;
    }

    if (isLink && linkElement) {
      const href = linkElement.getAttribute('href');
      if (href) {
        if (href.startsWith('http://') || href.startsWith('https://')) {
          e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        } else if (href.startsWith('#')) {
          e.preventDefault();
          const targetId = href.substring(1);
          const targetElement = previewRef.current?.querySelector(`[id="${targetId}"]`);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
      return;
    }

    while (target && target !== e.currentTarget) {
      const start = target.getAttribute('data-offset-start');
      const end = target.getAttribute('data-offset-end');
      if (start !== null && end !== null) {
        e.preventDefault();
        e.stopPropagation();
        const s = parseInt(start, 10);
        const e_offset = parseInt(end, 10);
        if (!isNaN(s) && !isNaN(e_offset)) {
          jumpTo({ offset: s, endOffset: e_offset });
        }
        return;
      }
      target = target.parentElement;
    }
  }, [jumpTo]);

  const importSelectedLocalFile = async (file) => {
    if (!file) return;

    if (!isMarkdownFile(file.name)) {
      showToast('Please choose a Markdown file (.md, .markdown).', 'error');
      return;
    }

    try {
      const text = await file.text();
      await handleCreateFile(file.name, text);
    } catch {
      showToast('Failed to import local file', 'error');
    }
  };

  const importLocalFile = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'] } }],
          multiple: false,
        });
        await importSelectedLocalFile(await handle.getFile());
      } catch (error) {
        if (error.name !== 'AbortError') showToast('Failed to open local file', 'error');
      }
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.mkd,text/markdown';
    input.addEventListener('change', () => {
      void importSelectedLocalFile(input.files?.[0]);
    }, { once: true });
    input.click();
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      {toast && <Toast type={toast.type} message={toast.message} />}

      <FloatingFormattingToolbar
        enabled={editorMode === 'visual' && (viewMode === 'edit' || viewMode === 'split')}
        insertText={formattingActions.insertText}
        insertDrawing={formattingActions.insertDrawing}
        toggleCode={formattingActions.toggleCode}
        insertCodeBlock={formattingActions.insertCodeBlock}
        toggleMath={formattingActions.toggleMath}
        activeFormats={editorMode === 'visual' ? activeFormats : null}
        shortcuts={shortcuts}
      />

      {(isResizingSidebar || isResizingSplit) && (
        <div className="fixed inset-0 z-[100] cursor-col-resize select-none" />
      )}

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

      <Suspense fallback={null}>
        {excalidrawModalState.isOpen && (
          <ExcalidrawModal
            key={`modal-${excalidrawModalState.rawCode || 'active'}`}
            isOpen={excalidrawModalState.isOpen}
            initialData={excalidrawModalState.initialData}
            onSave={handleSaveExcalidrawModal}
            onClose={() => setExcalidrawModalState((prev) => ({ ...prev, isOpen: false }))}
            theme={theme}
          />
        )}
      </Suspense>

      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        sidebarWidth={sidebarWidth}
        ghUser={ghUser}
        setShowAuthModal={setShowAuthModal}
        setShowShortcutModal={setShowShortcutModal}
        importLocalFile={importLocalFile}
        createFile={handleCreateFile}
        createFolder={handleCreateFolder}
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
        handleRefreshRepo={handleRefreshRepo}
        pathStack={pathStack}
        setPathStack={setPathStack}
        expandedPaths={expandedPaths}
        setExpandedPaths={setExpandedPaths}
        setCurrentRepo={setCurrentRepo}
        branches={branches}
        currentBranch={currentBranch}
        setBranches={setBranches}
        setCurrentBranch={setCurrentBranch}
        createBranch={createBranch}
        loadTOC={loadTOC}
        jumpTo={jumpTo}
        moveFile={handleMoveFile}
        modifiedFiles={modifiedFiles}
      />

      {isSidebarOpen && (
        <div 
          id="sidebar-resizer" 
          className="w-1 -ml-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group" 
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
          handleDiscardChanges={handleDiscardChanges}
          isModified={isModified}
          loadingState={loadingState}
          shortcuts={shortcuts}
          editorMode={editorMode}
          setEditorMode={setEditorMode}
          showFormattingTools={showFormattingTools}
          setShowFormattingTools={setShowFormattingTools}
        />

        {/* Dedicated Standalone Excalidraw Document View */}
        {activeFile && isExcalidrawFile(activeFile.name) ? (
          <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden relative">
            <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 text-xs shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-base">🎨</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{activeFile.name}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {activeFile.name.endsWith('.md') ? 'Obsidian Excalidraw Markdown' : 'Excalidraw Scene'}
                </span>
              </div>
              <div className="flex items-center bg-gray-200 dark:bg-gray-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStandaloneCanvasView('canvas')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    standaloneCanvasView === 'canvas'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Canvas View
                </button>
                <button
                  type="button"
                  onClick={() => setStandaloneCanvasView('raw')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    standaloneCanvasView === 'raw'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Raw Markdown/JSON
                </button>
              </div>
            </div>

            <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
              {standaloneCanvasView === 'canvas' ? (
                <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-gray-500">Loading Canvas...</div>}>
                  <ExcalidrawCanvas
                    key={activeFile.path}
                    initialData={parseExcalidrawContent(content)}
                    onChange={(elements, appState, files) => {
                      const updated = { elements, appState, files };
                      const formatted = activeFile.name.endsWith('.excalidraw')
                        ? JSON.stringify(updated, null, 2)
                        : serializeToObsidianDoc(updated);
                      setContent(formatted);
                    }}
                    theme={theme}
                    style={{ height: '100%', width: '100%', minHeight: '100%', border: 'none', borderRadius: 0 }}
                  />
                </Suspense>
              ) : (
                <CodeMirrorEditor
                  editorRef={editorRef}
                  content={content}
                  setContent={setContent}
                  theme={theme}
                  syntaxHighlighting={syntaxHighlighting}
                  onUpdate={() => triggerSyncUpdate(true)}
                />
              )}
            </div>
          </div>
        ) : (
          <div ref={mainAreaRef} className="flex-1 flex overflow-hidden relative">
            {/* Editor Column */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div 
                id="editor-container"
                className="flex flex-col h-full bg-white dark:bg-[#0d1117] relative"
                style={viewMode === 'split' ? { width: `${tempSplitRatio * 100}%` } : { flex: 1 }}
              >
                <div className={`transition-all duration-300 shrink-0 ${showFormattingTools ? 'h-[var(--bottom-bar-height)] opacity-100 border-b border-gray-200 dark:border-gray-800 overflow-visible' : 'h-0 opacity-0 overflow-hidden'}`}>
                  <FormattingToolbar 
                    viewMode={viewMode}
                    insertText={formattingActions.insertText}
                    insertListItem={formattingActions.insertListItem}
                    insertNumberedList={formattingActions.insertNumberedList}
                    insertTaskList={formattingActions.insertTaskList}
                    setBlockType={formattingActions.setBlockType}
                    insertTable={formattingActions.insertTable}
                    insertDrawing={formattingActions.insertDrawing}
                    undo={formattingActions.undo}
                    redo={formattingActions.redo}
                    toggleCode={formattingActions.toggleCode}
                    insertCodeBlock={formattingActions.insertCodeBlock}
                    toggleMath={formattingActions.toggleMath}
                    activeFormats={editorMode === 'visual' ? activeFormats : null}
                    showEmojiPicker={showEmojiPicker}
                    setShowEmojiPicker={setShowEmojiPicker}
                    emojiPickerRef={emojiPickerRef}
                    shortcuts={shortcuts}
                  />
                </div>
                <div className="flex-1 relative overflow-hidden pr-[2px]">
                  <SearchPanel 
                    editorMode={editorMode}
                    editorRef={editorRef} 
                    richEditorRef={richEditorRef} 
                  />
                  <div className="h-full overflow-hidden">
                    {editorMode === 'source' ? (
                      <CodeMirrorEditor 
                        editorRef={editorRef}
                        content={content}
                        setContent={setContent}
                        theme={theme}
                        syntaxHighlighting={syntaxHighlighting}
                        onUpdate={() => triggerSyncUpdate(true)}
                      />
                    ) : (
                      <Suspense fallback={<div className="visual-editor-loading">Loading visual editor...</div>}>
                        <RichMarkdownEditor
                          ref={richEditorRef}
                          content={content}
                          setContent={setContent}
                          onSelectionFormatChange={setActiveFormats}
                          theme={theme}
                          onOpenExcalidrawModal={handleOpenExcalidrawModal}
                          onUpdate={() => triggerSyncUpdate(true)}
                        />
                      </Suspense>
                    )}
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'split' && (
              <div 
                id="split-resizer" 
                className="w-1 -ml-1 cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group bg-transparent" 
                onMouseDown={() => { setIsResizingSplit(true); document.body.style.cursor = 'col-resize'; }}
              >
                <div className="h-full w-px bg-gray-200 dark:bg-gray-800 group-hover:bg-indigo-500 group-active:bg-indigo-500 transition-colors" />
              </div>
            )}

            <div 
              id="preview-column"
              className={`flex flex-col h-full bg-white dark:bg-[#0d1117] ${viewMode === 'edit' ? 'hidden' : ''}`}
              style={viewMode === 'split' ? { width: `${(1 - tempSplitRatio) * 100}%` } : { flex: 1 }}
            >
              <div id="preview-stats" className={`overflow-hidden transition-all duration-300 shrink-0 ${showFormattingTools ? 'h-[var(--bottom-bar-height)] opacity-100' : 'h-0 opacity-0'}`}>
                <div className="gme-stats-bar h-full flex items-center px-4 bg-gray-50 dark:bg-[#0d1117] space-x-3 text-xs">
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-1.5">Words:</span>
                    <span className="text-gray-700 dark:text-gray-300">{stats.words.toLocaleString()}</span>
                  </div>
                  <div className="w-px h-3 bg-gray-300 dark:bg-gray-700" />
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-1.5">Characters:</span>
                    <span className="text-gray-700 dark:text-gray-300">{stats.chars.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div id="preview-content" className="flex-1 overflow-hidden pl-[2px]">
                <Preview 
                  previewRef={previewRef}
                  parsedHtml={parsedHtml}
                  onClick={handlePreviewClick}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

