import React, { memo, useMemo, useRef, useEffect } from 'react';
import { 
  Github, FileText, Folder, Plus, ArrowLeft, ArrowDown, RefreshCcw, 
  EyeOff, Trash2, FileEdit, FileUp, LogOut, Loader2, GitBranch,
  Keyboard, Hash, ChevronRight, ChevronDown, ChevronUp,
  FilePlus, FolderPlus
  } from 'lucide-react';
  import logo from '../assets/logo.svg';

  const Sidebar = memo(({ 
  isSidebarOpen, 
  sidebarWidth,
  theme,
  ghUser,
  setShowAuthModal,
  setShowShortcutModal,
  showFormattingTools,
  setShowFormattingTools,
  importLocalFile,
  createFile,
  getWorkspaceFiles,  loadFile,
  activeFile,
  renameFile,
  deleteFile,
  setGhToken,
  setGhUser,
  currentRepo,
  repos,
  loadingState,
  hiddenRepos,
  setHiddenRepos,
  fetchRepoContents,
  handleRefreshRepo,
  manualRepo,
  setManualRepo,
  pathStack,
  setPathStack,
  expandedPaths,
  setExpandedPaths,
  setCurrentRepo,
  branches,
  currentBranch,
  setBranches,
  setCurrentBranch,
  createBranch,
  loadTOC,
  jumpTo,
  modifiedFiles = new Set()
}) => {
  const workspaceFiles = useMemo(() => getWorkspaceFiles(), [getWorkspaceFiles]);
  const clickTimerRef = useRef(null);
  const [collapsedPaths, setCollapsedPaths] = React.useState(new Set());
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = React.useState(false);
  const [branchSearch, setBranchSearch] = React.useState('');
  const branchDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBranches = useMemo(() => {
    return branches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase()));
  }, [branches, branchSearch]);

  const isAtTOC = useMemo(() => pathStack.length > 0 && pathStack[pathStack.length - 1].isTOC, [pathStack]);

  const toggleFolder = (e, path, file) => {
    if (e) e.stopPropagation();
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        // Silent fetch when expanding
        if (file && (file.repo || currentRepo)) {
          loadFile(file, false, true);
        }
      }
      return next;
    });
  };

  // Collapse all headings with children when entering TOC
  useEffect(() => {
    if (isAtTOC) {
      const initialCollapsed = new Set();
      for (let i = 0; i < workspaceFiles.length; i++) {
        const item = workspaceFiles[i];
        if (item.type === 'heading') {
          const nextItem = workspaceFiles[i + 1];
          const hasChildren = nextItem && nextItem.type === 'heading' && nextItem.level > item.level;
          if (hasChildren) {
            initialCollapsed.add(item.path);
          }
        }
      }
      setCollapsedPaths(initialCollapsed);
    } else {
      setCollapsedPaths(new Set());
    }
  }, [isAtTOC, workspaceFiles]);

  const toggleCollapse = (e, path) => {
    if (e) e.stopPropagation();
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Filter visible items based on collapse state
  const visibleItems = useMemo(() => {
    const filteredWorkspaceFiles = workspaceFiles.filter(item => item.name !== '.gitkeep');

    if (!isAtTOC) return filteredWorkspaceFiles;
    
    const visible = [];
    let hiddenLevel = Infinity;

    for (const item of filteredWorkspaceFiles) {
      if (item.type !== 'heading') {
        visible.push(item);
        continue;
      }

      if (item.level <= hiddenLevel) {
        hiddenLevel = Infinity;
        visible.push(item);
        
        if (collapsedPaths.has(item.path)) {
          hiddenLevel = item.level;
        }
      }
    }
    return visible;
  }, [workspaceFiles, isAtTOC, collapsedPaths]);

  const getHeaderStyle = (level) => {
    switch (level) {
      case 1: return "text-sm text-gray-900 dark:text-white leading-tight";
      case 2: return "text-[13px] text-gray-800 dark:text-gray-100 leading-tight";
      case 3: return "text-[12px] text-gray-700 dark:text-gray-200 leading-tight";
      default: return "text-[11px] text-gray-600 dark:text-gray-400 leading-tight";
    }
  };

  const handleFileClick = (file) => {
    if (file.type === 'heading') {
      const idx = workspaceFiles.findIndex(f => f.path === file.path);
      const hasChildren = workspaceFiles[idx + 1]?.level > file.level;
      if (hasChildren) {
        toggleCollapse(null, file.path);
      }
      jumpTo({ line: file.line });
      return;
    }

    if (file.type === 'dir') {
      toggleFolder(null, file.path, file);
      return;
    }

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      loadTOC(file);
    } else {
      clickTimerRef.current = setTimeout(() => {
        loadFile(file);
        clickTimerRef.current = null;
      }, 250);
    }
  };

  if (!isSidebarOpen) return null;

  return (
    <div id="main-sidebar" className="group/sidebar flex-shrink-0 bg-gray-50 dark:bg-[#161b22] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-none overflow-hidden relative" style={{ width: sidebarWidth }}>
      <div className="h-11 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <img src={logo} alt="Logo" className="h-5 w-auto mr-2" />
        <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
          Git Markdown
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {!ghUser ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 p-4 rounded-lg text-center">
              <Github className="w-8 h-8 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Sync files with your GitHub repositories.</p>
              <button onClick={() => setShowAuthModal(true)} className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded text-sm font-medium transition-colors text-gray-900 dark:text-gray-200">
                Connect Account
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2 px-1 h-7">
                <h3 className="flex-1 min-w-0 text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                  {isAtTOC ? pathStack[pathStack.length-1].name : 'Local Workspace'}
                </h3>
                <div className="hidden group-hover/sidebar:flex space-x-1 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 ml-2">
                  {isAtTOC && pathStack.length > 0 && (
                    <button onClick={() => { 
                      const ns = [...pathStack];
                      ns.pop();
                      setPathStack(ns);
                    }} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><ArrowLeft className="w-3 h-3" /></button>
                  )}
                  {!isAtTOC && (
                    <>
                      <button onClick={importLocalFile} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded" title="Import File"><FileUp className="w-3 h-3" /></button>
                      <button onClick={() => createFile(prompt('Enter new file or folder name (no extension for folders):') || 'untitled.md')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded" title="New file or folder"><Plus className="w-3 h-3" /></button>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-0.5">
                {visibleItems.map((file, idx) => {
                  const isTOCHeading = isAtTOC && file.type === 'heading';
                  const hasChildren = isTOCHeading ? (workspaceFiles[workspaceFiles.indexOf(file) + 1]?.level > file.level) : (file.type === 'dir');
                  const isCollapsed = isTOCHeading ? collapsedPaths.has(file.path) : (file.type === 'dir' && !expandedPaths.has(file.path));

                  return (
                    <li key={file.path} className="relative">
                      <div className="flex items-center group">
                        <button 
                          onClick={() => handleFileClick(file)} 
                          className={`flex-1 flex items-center px-2 rounded transition-colors text-left group min-w-0 relative ${file.type === 'heading' ? `${getHeaderStyle(file.level)} py-0.5` : `text-sm py-1 ${activeFile?.path === file.path && ((!activeFile.repo && file.isLocal) || (activeFile.repo === currentRepo && (activeFile.branch || currentBranch) === currentBranch)) && !isAtTOC ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}`}
                          style={{ paddingLeft: isTOCHeading ? `${(file.level - 1) * 0.75 + 1}rem` : `${(file.depth || 0) * 0.75 + 1}rem` }}
                        >
                          {hasChildren && (
                            <span 
                              className="absolute flex items-center justify-center pointer-events-none"
                              style={{ left: isTOCHeading ? `${(file.level - 1) * 0.75 + 0.125}rem` : `${(file.depth || 0) * 0.75 + 0.125}rem`, width: '1rem', height: '100%' }}
                            >
                              {isCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                            </span>
                          )}
                          {file.type !== 'heading' && file.type !== 'dir' && (
                              <FileText className={`w-4 h-4 mr-2 shrink-0 ${!file.isLocal && modifiedFiles.has(`${currentRepo}/${currentBranch}/${file.path}`) ? 'text-amber-500' : 'text-gray-500'}`} />
                          )}
                          <span 
                            className="flex-1 truncate min-w-0" 
                            title={file.rawName || file.name}
                            dangerouslySetInnerHTML={file.type === 'heading' ? { __html: file.name } : undefined}
                          >
                            {file.type !== 'heading' ? (
                              <div className="flex items-center justify-between">
                                <span className="truncate">{file.name}</span>
                                <div className="w-4 h-4 flex items-center justify-center ml-2 shrink-0">
                                  {file.status === 'pending' ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                  ) : (
                                    !file.isLocal && modifiedFiles.has(`${currentRepo}/${currentBranch}/${file.path}`) && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                                    )
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </span>
                        </button>
                        {file.type !== 'heading' && !isAtTOC && (
                          <div className={`flex items-center transition-opacity opacity-0 ${file.status === 'pending' ? 'pointer-events-none' : 'group-hover:opacity-100'}`}>
                            {file.type === 'dir' && (
                              <>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const name = prompt('New file name:');
                                    if (name) {
                                      createFile(name, '', file.path);
                                    }
                                  }} 
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                  title="New File in this folder"
                                >
                                  <FilePlus className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const name = prompt('New folder name:');
                                    if (name) {
                                      createFile(name, '', file.path);
                                    }
                                  }} 
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                  title="New Folder in this folder"
                                >
                                  <FolderPlus className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); renameFile(file); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded mr-1"><FileEdit className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {visibleItems.length === 0 && <p className="text-xs text-gray-500 px-2 italic">No files</p>}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-[#0d1117] p-2 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="flex items-center truncate">
                <img src={ghUser.avatar_url} alt="Avatar" className="w-6 h-6 rounded-full mr-2" />
                <span className="text-sm font-medium truncate text-gray-900 dark:text-gray-200">{ghUser.login}</span>
              </div>
              <button onClick={() => { setGhToken(''); setGhUser(null); localStorage.removeItem('gme_gh_token'); }} className="text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded" title="Disconnect"><LogOut className="w-4 h-4" /></button>
            </div>
            {!currentRepo ? (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Repositories</h3>
                {loadingState === 'fetching' ? (
                  <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
                ) : (
                  <div className="space-y-4">
                    <ul className="space-y-1">
                      {repos.filter(r => !hiddenRepos.includes(r.full_name)).map(repo => (
                        <li key={repo.id} className="flex items-center group">
                          <button onClick={() => fetchRepoContents(repo.full_name)} className="flex-1 flex items-center px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-l text-sm text-gray-700 dark:text-gray-300 transition-colors text-left overflow-hidden">
                            <Folder className="w-4 h-4 mr-2 text-blue-500 dark:text-indigo-400 shrink-0" />
                            <span className="truncate">{repo.name}</span>
                          </button>
                          <button onClick={() => setHiddenRepos([...hiddenRepos, repo.full_name])} className="opacity-0 group-hover:opacity-100 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all rounded-r"><EyeOff className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                    {hiddenRepos.length > 0 && (
                      <div className="px-1 -mt-2 mb-2">
                        <button onClick={() => setHiddenRepos([])} className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Restore {hiddenRepos.length} hidden repo(s)</button>
                      </div>
                    )}
                    <div className="px-1 border-t border-gray-200 dark:border-gray-800 pt-3">
                      <p className="text-xs text-gray-500 mb-2">Can't see your repo? Enter manually:</p>
                      <div className="flex space-x-2">
                        <input type="text" placeholder="owner/repo" value={manualRepo} onChange={(e) => setManualRepo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manualRepo && fetchRepoContents(manualRepo)} className="flex-1 w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none" />
                        <button onClick={() => manualRepo && fetchRepoContents(manualRepo)} disabled={!manualRepo} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded text-xs font-medium text-gray-700 dark:text-gray-300">Go</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2 px-1 h-7">
                  <h3 className="flex-1 min-w-0 text-xs font-semibold text-gray-500 uppercase tracking-wider truncate" title={currentRepo}>{isAtTOC ? pathStack[pathStack.length-1].name : currentRepo}</h3>
                  <div className="hidden group-hover/sidebar:flex space-x-1 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 ml-2">
                    <button onClick={() => { 
                      if (isAtTOC) {
                        const ns = [...pathStack];
                        ns.pop();
                        setPathStack(ns);
                        return;
                      }

                      setCurrentRepo(null);
                      setPathStack([]);
                      // Clear branch state when going back to repo list
                      setCurrentBranch('');
                      setBranches([]);
                    }} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><ArrowLeft className="w-3 h-3" /></button>
                    {!isAtTOC && (
                      <>
                        <button onClick={importLocalFile} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><FileUp className="w-3 h-3" /></button>
                        <button onClick={() => createFile(prompt('Enter new file name:') || 'untitled.md')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><Plus className="w-3 h-3" /></button>
                        <button onClick={handleRefreshRepo} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded" title="Refresh file list and branches"><RefreshCcw className="w-3 h-3" /></button>
                      </>
                    )}
                  </div>
                </div>

                {!isAtTOC && (
                  <div className="px-1 mb-4 relative" ref={branchDropdownRef}>
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <GitBranch className="w-3 h-3 mr-1" /> Branch
                      </div>
                      <button 
                        onClick={() => createBranch(prompt('New branch name:'))} 
                        className="text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200"
                        title="New Branch"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                      className="w-full flex items-center justify-between bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-200 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all text-left shadow-sm group"
                    >
                      <span className="truncate">
                        {currentBranch}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isBranchDropdownOpen && (
                      <div className="absolute left-1 right-1 mt-1 z-50 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                          <div className="relative">
                            <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-gray-500" />
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search branches..."
                              value={branchSearch}
                              onChange={(e) => setBranchSearch(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700 rounded-md pl-7 pr-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                          {filteredBranches.length > 0 ? (
                            filteredBranches.map(b => (
                              <button
                                key={b.name}
                                onClick={() => {
                                  setCurrentBranch(b.name);
                                  fetchRepoContents(currentRepo, '', b.name);
                                  setIsBranchDropdownOpen(false);
                                  setBranchSearch('');
                                }}
                                className={`w-full flex items-center px-3 py-1.5 text-xs transition-colors hover:text-indigo-600 dark:hover:text-indigo-300 ${currentBranch === b.name ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                              >
                                <span className="truncate">{b.name}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-center text-xs text-gray-500 italic">No branches found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {loadingState === 'fetching' ? <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div> : (
                  <ul className="space-y-0.5">
                    {visibleItems.map((file, idx) => {
                      const isTOCHeading = isAtTOC && file.type === 'heading';
                      const hasChildren = isTOCHeading ? (workspaceFiles[workspaceFiles.indexOf(file) + 1]?.level > file.level) : (file.type === 'dir');
                      const isCollapsed = isTOCHeading ? collapsedPaths.has(file.path) : (file.type === 'dir' && !expandedPaths.has(file.path));

                      return (
                        <li key={file.path} className="relative">
                          <div className={`flex items-center group ${file.status === 'pending' ? 'opacity-70' : ''}`}>
                            <button 
                              onClick={() => handleFileClick(file)} 
                              className={`flex-1 flex items-center px-2 rounded transition-colors text-left group min-w-0 relative ${file.type === 'heading' ? `${getHeaderStyle(file.level)} py-0.5` : `text-sm py-1 ${activeFile?.path === file.path && ((!activeFile.repo && file.isLocal) || (activeFile.repo === currentRepo && (activeFile.branch || currentBranch) === currentBranch)) && !isAtTOC ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}`}
                              style={{ paddingLeft: isTOCHeading ? `${(file.level - 1) * 0.75 + 1}rem` : `${(file.depth || 0) * 0.75 + 1}rem` }}
                            >
                              {hasChildren && (
                                <span 
                                  className="absolute flex items-center justify-center pointer-events-none"
                                  style={{ left: isTOCHeading ? `${(file.level - 1) * 0.75 + 0.125}rem` : `${(file.depth || 0) * 0.75 + 0.125}rem`, width: '1rem', height: '100%' }}
                                >
                                  {isCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                                </span>
                              )}
                              {file.type !== 'heading' && file.type !== 'dir' && (
                                  <FileText className={`w-4 h-4 mr-2 shrink-0 ${!file.isLocal && modifiedFiles.has(`${currentRepo}/${currentBranch}/${file.path}`) ? 'text-amber-500' : 'text-gray-500'}`} />
                              )}
                              <span 
                                className="flex-1 truncate min-w-0" 
                                title={file.rawName || file.name}
                                dangerouslySetInnerHTML={file.type === 'heading' ? { __html: file.name } : undefined}
                              >
                                {file.type !== 'heading' ? (
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">{file.name}</span>
                                    <div className="w-4 h-4 flex items-center justify-center ml-2 shrink-0">
                                      {file.status === 'pending' ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                      ) : (
                                        !file.isLocal && modifiedFiles.has(`${currentRepo}/${currentBranch}/${file.path}`) && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                                        )
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </span>
                            </button>
                            {file.type !== 'heading' && !isAtTOC && (
                              <div className={`flex items-center transition-opacity opacity-0 ${file.status === 'pending' ? 'pointer-events-none' : 'group-hover:opacity-100'}`}>
                                {file.type === 'dir' && (
                                  <>
                                    <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        const name = prompt('New file name:');
                                        if (name) {
                                          createFile(name, '', file.path);
                                        }
                                      }} 
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                      title="New File in this folder"
                                    >
                                      <FilePlus className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        const name = prompt('New folder name:');
                                        if (name) {
                                          createFile(name, '', file.path);
                                        }
                                      }} 
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                      title="New Folder in this folder"
                                    >
                                      <FolderPlus className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); renameFile(file); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded mr-1"><FileEdit className="w-4 h-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                    {visibleItems.length === 0 && <p className="text-xs text-gray-500 px-2 italic">{isAtTOC ? 'No headings' : 'Empty folder'}</p>}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`border-t border-gray-200 dark:border-gray-800 shrink-0 relative z-20 transition-all duration-300 bg-gray-50 dark:bg-[#161b22] ${showFormattingTools ? 'h-10 opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
        <div className="flex items-center px-2 h-10">
          <button 
            onClick={() => setShowFormattingTools(false)}
            className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors"
            title="Hide tools"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowShortcutModal(true)} 
            className="flex-1 flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all"
          >
            <Keyboard className="w-4 h-4 mr-3" />
            Shortcuts
          </button>
        </div>
      </div>
      <div className={`absolute left-2 z-10 transition-all duration-300 ease-out ${showFormattingTools ? 'bottom-[-40px] opacity-0' : 'bottom-2 opacity-100'}`}>
          <button 
            onClick={() => setShowFormattingTools(true)}
            className="p-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md shadow-lg transition-all"
            title="Show tools"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
      </div>
    </div>
  );
});

export default Sidebar;
