import React, { memo, useMemo, useRef } from 'react';
import { 
  Github, FileText, Folder, Plus, ArrowLeft, ArrowDown, RefreshCcw, 
  EyeOff, Trash2, FileEdit, FileUp, LogOut, Loader2, GitBranch,
  Keyboard, Hash, ChevronRight, ChevronDown
} from 'lucide-react';

const Sidebar = memo(({
  isSidebarOpen,
  sidebarWidth,
  ghUser,
  setShowAuthModal,
  setShowShortcutModal,
  importLocalFile,
  createFile,
  getWorkspaceFiles,
  loadFile,
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
  setCurrentRepo,
  branches,
  currentBranch,
  setCurrentBranch,
  createBranch,
  loadTOC,
  jumpTo,
  modifiedFiles = new Set()
}) => {
  const workspaceFiles = useMemo(() => getWorkspaceFiles(), [getWorkspaceFiles]);
  const clickTimerRef = useRef(null);
  const [collapsedPaths, setCollapsedPaths] = React.useState(new Set());

  const isAtTOC = useMemo(() => pathStack.length > 0 && pathStack[pathStack.length - 1].isTOC, [pathStack]);

  const toggleCollapse = (e, path) => {
    e.stopPropagation();
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Filter visible items based on collapse state
  const visibleItems = useMemo(() => {
    if (!isAtTOC) return workspaceFiles;
    
    const visible = [];
    let hiddenLevel = Infinity;

    for (const item of workspaceFiles) {
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
      case 1: return "text-sm mt-1 mb-0 text-gray-900 dark:text-white leading-tight";
      case 2: return "text-[13px] mt-0.5 mb-0 text-gray-800 dark:text-gray-100 leading-tight";
      case 3: return "text-[12px] mt-0.5 mb-0 text-gray-700 dark:text-gray-200 leading-tight";
      default: return "text-[11px] mt-0 mb-0 text-gray-600 dark:text-gray-400 leading-tight";
    }
  };

  const handleFileClick = (file) => {
    if (file.type === 'heading') {
      jumpTo({ line: file.line });
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
    <div id="main-sidebar" className="flex-shrink-0 bg-gray-50 dark:bg-[#161b22] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-none overflow-hidden relative" style={{ width: sidebarWidth }}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span className="font-bold flex items-center text-gray-900 dark:text-gray-100 truncate">
          <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xl mr-2 flex items-center">
            <Github className="w-[1rem] h-[1rem] mr-0.2 -mt-[2px]" strokeWidth={2.8}/>M&gt;_
          </span> 
          Explorer
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
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">Local Workspace</h3>
                <div className="flex space-x-1">
                  <button onClick={importLocalFile} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded" title="Import File"><FileUp className="w-3 h-3" /></button>
                  <button onClick={() => createFile(prompt('Enter new file name:') || 'untitled.md')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded" title="New file"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
              <ul className="space-y-1">
                {visibleItems.map((file, idx) => {
                  const hasChildren = isAtTOC && file.type === 'heading' && workspaceFiles[workspaceFiles.indexOf(file) + 1]?.level > file.level;
                  const isCollapsed = collapsedPaths.has(file.path);

                  return (
                    <li key={file.path} className="relative">
                      <div className="flex items-center group">
                        {isAtTOC && file.type === 'heading' && hasChildren && (
                          <button 
                            onClick={(e) => toggleCollapse(e, file.path)}
                            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded absolute z-10 transition-colors"
                            style={{ left: `${(file.level - 1) * 0.75 + 0.125}rem` }}
                          >
                            {isCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                          </button>
                        )}
                        <button 
                          onClick={() => handleFileClick(file)} 
                          className={`flex-1 flex items-center px-2 rounded transition-colors text-left group min-w-0 ${file.type === 'heading' ? `${getHeaderStyle(file.level)} py-0.5` : `text-sm py-1.5 ${activeFile?.path === file.path && ((!activeFile.repo && file.isLocal) || activeFile.repo === currentRepo) && !isAtTOC ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}`}
                          style={file.type === 'heading' ? { paddingLeft: `${(file.level - 1) * 0.75 + 1}rem` } : {}}
                        >
                          {file.type !== 'heading' && <FileText className={`w-4 h-4 mr-2 shrink-0 ${modifiedFiles.has(`local/${file.path}`) ? 'text-amber-500' : 'text-gray-500'}`} />}
                          <span 
                            className="flex-1 truncate min-w-0" 
                            title={file.rawName || file.name}
                            dangerouslySetInnerHTML={file.type === 'heading' ? { __html: file.name } : undefined}
                          >
                            {file.type !== 'heading' ? (
                              <div className="flex items-center justify-between">
                                <span className="truncate">{file.name}</span>
                                <div className="w-4 h-4 flex items-center justify-center ml-2 shrink-0">
                                  {modifiedFiles.has(`local/${file.path}`) && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </span>
                        </button>
                        {file.type !== 'heading' && (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); renameFile(file); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded mr-1"><FileEdit className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all rounded"><Trash2 className="w-4 h-4" /></button>
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
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate" title={currentRepo}>{isAtTOC ? pathStack[pathStack.length-1].name : currentRepo}</h3>
                  <div className="flex space-x-1">
                    <button onClick={() => { 
                      if (isAtTOC) {
                        const ns = [...pathStack];
                        ns.pop();
                        setPathStack(ns);
                        return;
                      }

                      if (pathStack.length > 0) {
                        const ns = [...pathStack];
                        ns.pop();
                        setPathStack(ns);
                        fetchRepoContents(currentRepo, ns.length > 0 ? ns[ns.length - 1].path : '');
                      } else {
                        setCurrentRepo(null);
                        setPathStack([]);
                        // Clear branch state when going back to repo list
                        setCurrentBranch('');
                        setBranches([]);
                      }
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
                  <div className="px-1 mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <GitBranch className="w-3 h-3 mr-1" /> Branch
                      </div>
                      <button 
                        onClick={() => createBranch(prompt('New branch name:'))} 
                        className="text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="New Branch"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <select 
                      value={currentBranch} 
                      onChange={(e) => {
                        setCurrentBranch(e.target.value);
                        fetchRepoContents(currentRepo, '', e.target.value);
                      }}
                      className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none appearance-none cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                    >
                      {branches.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {pathStack.length > 0 && !isAtTOC && (
                  <button onClick={() => { const ns = [...pathStack]; ns.pop(); setPathStack(ns); fetchRepoContents(currentRepo, ns.length > 0 ? ns[ns.length - 1].path : ''); }} className="w-full flex items-center px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <ArrowLeft className="w-4 h-4 mr-2 shrink-0" /><span className="truncate">.. / {pathStack[pathStack.length-1].name}</span>
                  </button>
                )}
                {loadingState === 'fetching' ? <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div> : (
                  <ul className="space-y-1">
                    {visibleItems.map((file, idx) => {
                      const hasChildren = isAtTOC && file.type === 'heading' && workspaceFiles[workspaceFiles.indexOf(file) + 1]?.level > file.level;
                      const isCollapsed = collapsedPaths.has(file.path);

                      return (
                        <li key={file.path} className="relative">
                          <div className={`flex items-center group ${file.status === 'pending' ? 'opacity-70' : ''}`}>
                            {isAtTOC && file.type === 'heading' && hasChildren && (
                              <button 
                                onClick={(e) => toggleCollapse(e, file.path)}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded absolute z-10 transition-colors"
                                style={{ left: `${(file.level - 1) * 0.75 + 0.125}rem` }}
                              >
                                {isCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                              </button>
                            )}
                            <button 
                              onClick={() => handleFileClick(file)} 
                              className={`flex-1 flex items-center px-2 rounded transition-colors text-left group min-w-0 ${file.type === 'heading' ? `${getHeaderStyle(file.level)} py-0.5` : `text-sm py-1.5 ${activeFile?.path === file.path && ((!activeFile.repo && file.isLocal) || activeFile.repo === currentRepo) && !isAtTOC ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}`}
                              style={file.type === 'heading' ? { paddingLeft: `${(file.level - 1) * 0.75 + 1}rem` } : {}}
                            >
                              {file.type !== 'heading' && (
                                  file.type === 'dir' ? (
                                      <Folder className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400 shrink-0" />
                                  ) : (
                                      <FileText className={`w-4 h-4 mr-2 shrink-0 ${modifiedFiles.has(`${currentRepo}/${file.path}`) ? 'text-amber-500' : 'text-gray-500'}`} />
                                  )
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
                                        modifiedFiles.has(`${currentRepo}/${file.path}`) && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                                        )
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </span>
                            </button>
                            {file.type === 'file' && !isAtTOC && (
                              <div className={`flex items-center transition-opacity opacity-0 ${file.status === 'pending' ? 'pointer-events-none' : 'group-hover:opacity-100'}`}>
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
      <div className="p-2 border-t border-gray-200 dark:border-gray-800 shrink-0">
        <button 
          onClick={() => setShowShortcutModal(true)} 
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all"
        >
          <Keyboard className="w-4 h-4 mr-3" />
          Shortcuts
        </button>
      </div>
    </div>
  );
});

export default Sidebar;

