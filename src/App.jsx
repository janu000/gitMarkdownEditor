import React, { useEffect, useRef, useCallback, useDeferredValue, useMemo } from 'react';

// Components
import Toast from './components/Toast';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import FormattingToolbar from './components/FormattingToolbar';
import { EditorView } from 'codemirror';
import CodeMirrorEditor from './components/CodeMirrorEditor';
import Preview from './components/Preview';
import ShortcutModal from './components/ShortcutModal';
import SearchPanel from './components/SearchPanel';

// Hooks
import useStore, { defaultContent, DEFAULT_MARKDOWN } from './store/useStore';
import useLayoutResizer from './hooks/useLayoutResizer';
import useMarkdownParser from './hooks/useMarkdownParser';
import useGitHub from './hooks/useGitHub';
import useFormatting from './hooks/useFormatting';
import useShortcuts from './hooks/useShortcuts';
import useWorkspace from './hooks/useWorkspace';
import useSyncScroll from './hooks/useSyncScroll';
import { storage } from './utils/storage';

export default function App() {
  // --- Refs ---
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const mainAreaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const activeFileRef = useRef(null);

  // --- State from Store ---
  const {
    content, setContent,
    theme, setTheme,
    viewMode, setViewMode,
    syntaxHighlighting, setSyntaxHighlighting,
    loadingState, setLoadingState,
    toast, showToast,
    showAuthModal, setShowAuthModal,
    showShortcutModal, setShowShortcutModal,
    showEmojiPicker, setShowEmojiPicker,
    showFormattingTools, setShowFormattingTools,
    shortcuts, setShortcuts,
    localFileName, setLocalFileName,
    activeFile, setActiveFile,
    pendingOps, setPendingOps,
    pathStack, setPathStack,
    expandedPaths, setExpandedPaths,
    modifiedFiles, setModifiedFiles,
    setSearchVisible, setReplaceVisible
  } = useStore();

  // Use deferred value for expensive operations like parsing
  const deferredContent = useDeferredValue(content);

  const {
    localWorkspaceFiles, createLocalFile, createLocalFolder, renameLocalFile, deleteLocalFile, updateLocalFileContent
  } = useWorkspace(showToast);

  // Sync refs (debounced for performance)
  useEffect(() => { 
    activeFileRef.current = activeFile; 
  }, [activeFile]);
  
  // --- Hooks ---
  const { 
    sidebarWidth, splitRatio, tempSplitRatio, setSplitRatio, 
    isResizingSidebar, setIsResizingSidebar, 
    isResizingSplit, setIsResizingSplit, 
    isSidebarOpen, setIsSidebarOpen 
  } = useLayoutResizer(mainAreaRef);

  const { 
    parsedHtml, tocHeadings, isExpensive,
    updateTOC, updatePreview 
  } = useMarkdownParser(showToast, setLoadingState);

  const {
    ghToken, setGhToken, ghUser, setGhUser, repos, setRepos,
    currentRepo, setCurrentRepo, currentRepoRef, repoContents, setRepoContents,
    branches, setBranches, currentBranch, setCurrentBranch, currentBranchRef,
    manualRepo, setManualRepo, hiddenRepos, setHiddenRepos,
    apiRequest, fetchRepos, verifyGitHubToken, fetchRepoContents,
    saveToGitHub, loadFile, renameFile: renameGHFile, deleteFile: deleteGHFile, createFile: createGHFile, createFolder: createGHFolder, loadTOC, createBranch
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
  }, []); // Only once on mount

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
  }, [content, activeFile, currentRepo, currentBranch]);

  const { 
    insertText, insertListItem, insertNumberedList, insertTaskList,
    toggleCode, toggleMath
  } = useFormatting(editorRef);

  const handleExportPdf = useCallback(() => window.print(), []);

  const actions = useMemo(() => ({
    saveToGitHub, handleExportPdf, 
    insertText, insertListItem, insertNumberedList, insertTaskList,
    toggleCode, toggleMath,
    setSearchVisible, setReplaceVisible
  }), [saveToGitHub, handleExportPdf, insertText, insertListItem, insertNumberedList, insertTaskList, toggleCode, toggleMath, setSearchVisible, setReplaceVisible]);

  const handleExportPdfCallback = useCallback(() => handleExportPdf(), [handleExportPdf]);

  useShortcuts(shortcuts, actions);
  const triggerSyncUpdate = useSyncScroll(editorRef, previewRef, viewMode === 'split', parsedHtml);

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
  }, [showEmojiPicker]);

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

    const isFolder = !name.includes('.');

    if (isFolder) {
      if (currentRepo) {
        await createGHFolder(name, parentPath);
      } else {
        const currentPath = parentPath !== null ? parentPath : (pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '');
        await createLocalFolder(name, currentPath);
      }
      return;
    }

    if (currentRepo) {
      await createGHFile(name, initialContent, parentPath);
    } else {
      const currentPath = parentPath !== null ? parentPath : (pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '');
      const newFile = await createLocalFile(name, currentPath, initialContent);
      if (newFile) {
        setActiveFile(newFile);
        setContent(initialContent);
      }
    }
  }, [currentRepo, createGHFile, createLocalFile, createGHFolder, createLocalFolder, setContent, pathStack]);

  const handleCreateFolder = useCallback(async (name, parentPath = null) => {
    if (currentRepo) {
      await createGHFolder(name, parentPath);
    } else {
      const currentPath = parentPath !== null ? parentPath : (pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '');
      await createLocalFolder(name, currentPath);
    }
  }, [currentRepo, createGHFolder, createLocalFolder, pathStack]);

  const handleRenameFile = useCallback(async (file) => {
    if (currentRepo) {
      await renameGHFile(file);
    } else {
      const newName = prompt(`Rename ${file.name} to:`, file.name);
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
  }, [currentRepo, renameGHFile, renameLocalFile, activeFile]);

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
  }, [currentRepo, deleteGHFile, deleteLocalFile, activeFile, setContent]);

  // Helper to get depth of a path
  const getDepth = (path) => path === '' ? 0 : path.split('/').length;

  // --- Helper Functions ---
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
  }, [activeFile, currentRepo, currentBranch, setContent, setModifiedFiles, showToast]);

  const isModified = useMemo(() => {
    if (!activeFile) {
      // For the scratchpad, we check if content differs from default
      return content !== (defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN);
    }
    
    // Local files are always "up to date" in the context of this app's UI
    if (!activeFile.repo) return false;

    const storagePath = `${activeFile.repo}/${activeFile.branch || currentBranch}/${activeFile.path}`;
    return modifiedFiles.has(storagePath);
  }, [activeFile, currentRepo, currentBranch, modifiedFiles, content]);

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

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      {toast && <Toast type={toast.type} message={toast.message} />}

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

      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        sidebarWidth={sidebarWidth}
        theme={theme}
        ghUser={ghUser}
        setShowAuthModal={setShowAuthModal}
        setShowShortcutModal={setShowShortcutModal}
        showFormattingTools={showFormattingTools}
        setShowFormattingTools={setShowFormattingTools}
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
        handleRefreshRepo={handleRefreshRepo}
        manualRepo={manualRepo}
        setManualRepo={setManualRepo}
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
          syntaxHighlighting={syntaxHighlighting}
          setSyntaxHighlighting={setSyntaxHighlighting}
          handleDownload={handleDownload}
          handleExportPdf={handleExportPdfCallback}
          saveToGitHub={handleSave}
          handleDiscardChanges={handleDiscardChanges}
          isModified={isModified}
          loadingState={loadingState}
          shortcuts={shortcuts}
        />

        <div ref={mainAreaRef} className="flex-1 flex overflow-hidden relative">
          {/* Editor Column */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div 
              className="flex flex-col h-full bg-white dark:bg-[#0d1117] relative"
              style={viewMode === 'split' ? { width: `${tempSplitRatio * 100}%` } : { flex: 1 }}
            >
              <div className="flex-1 relative overflow-hidden pr-[2px]">
                <SearchPanel editorRef={editorRef} />
                <div className="h-full overflow-hidden">
                  <CodeMirrorEditor 
                    editorRef={editorRef}
                    content={content}
                    setContent={setContent}
                    theme={theme}
                    syntaxHighlighting={syntaxHighlighting}
                    onUpdate={() => triggerSyncUpdate(true)}
                  />
                </div>
              </div>
              <div className={`overflow-hidden transition-all duration-300 shrink-0 ${showFormattingTools ? 'h-10 opacity-100 border-t border-gray-200 dark:border-gray-800' : 'h-0 opacity-0'}`}>
                <FormattingToolbar 
                  viewMode={viewMode}
                  insertText={insertText}
                  insertListItem={insertListItem}
                  insertNumberedList={insertNumberedList}
                  insertTaskList={insertTaskList}
                  toggleCode={toggleCode}
                  toggleMath={toggleMath}
                  showEmojiPicker={showEmojiPicker}
                  setShowEmojiPicker={setShowEmojiPicker}
                  emojiPickerRef={emojiPickerRef}
                  shortcuts={shortcuts}
                />
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

          {/* Preview Column */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div 
              className="flex flex-col h-full bg-white dark:bg-[#0d1117]"
              style={viewMode === 'split' ? { width: `${(1 - tempSplitRatio) * 100}%` } : { flex: 1 }}
            >
              <div className="flex-1 overflow-hidden pl-[2px]">
                <Preview 
                  previewRef={previewRef}
                  parsedHtml={parsedHtml}
                  onClick={handlePreviewClick}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
