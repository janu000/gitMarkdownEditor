import React, { memo } from 'react';
import { 
  Columns, Sun, Moon, Edit3, Eye, Download, Printer, Save, Loader2 
} from 'lucide-react';
import { formatShortcut } from '../utils/shortcutManager';

const Toolbar = memo(({
  isSidebarOpen,
  setIsSidebarOpen,
  activeFile,
  currentRepo,
  currentBranch,
  content,
  localFileName,
  theme,
  setTheme,
  viewMode,
  setViewMode,
  handleDownload,
  handleExportPdf,
  saveToGitHub,
  loadingState,
  shortcuts,
  isUnified
}) => {
  const isModified = content !== localStorage.getItem('gme_draft');

  return (
    <div id="top-toolbar" className="h-14 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center space-x-2">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors mr-2">
          <Columns className="w-5 h-5" />
        </button>
        <div className="flex items-center text-sm">
          {activeFile ? (
            <>
              <span className="text-gray-500">{currentRepo} ({currentBranch}) / </span>
              <span className="text-gray-900 dark:text-gray-200 ml-1 font-medium">{activeFile.name}</span>
              {isModified && <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" title="Unsaved changes"></span>}
            </>
          ) : localFileName ? (
            <>
              <span className="text-gray-500 italic">Local / </span>
              <span className="text-gray-900 dark:text-gray-200 ml-1 font-medium">{localFileName}</span>
            </>
          ) : (
            <span className="text-gray-500 italic">Local Draft (Unsynced)</span>
          )}
          {isUnified && (
            <span className="ml-3 px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20" title="AST-Level Sync Active">
              Sync
            </span>
          )}
          {loadingState && (
            <span className="ml-3 flex items-center gap-1 text-[11px] text-gray-500 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              {loadingState === 'fetching' ? 'Syncing...' : 'Saving...'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 border border-gray-300 dark:border-gray-700 mr-4">
          <button onClick={() => setViewMode('edit')} className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Edit3 className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('split')} className={`p-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Columns className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('preview')} className={`p-1.5 rounded-md transition-all ${viewMode === 'preview' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Eye className="w-4 h-4" /></button>
        </div>
        <button onClick={handleDownload} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2" title="Download File"><Download className="w-5 h-5" /></button>
        <button onClick={handleExportPdf} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2" title={`Export to PDF (${formatShortcut(shortcuts.print)})`}><Printer className="w-5 h-5" /></button>
        <button onClick={saveToGitHub} disabled={!activeFile || loadingState === 'saving'} title={activeFile ? `${currentRepo ? 'Commit' : 'Save'} (${formatShortcut(shortcuts.save)})` : 'No file to save'} className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeFile ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
          {loadingState === 'saving' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {currentRepo ? 'Commit' : 'Save'}
        </button>
      </div>
    </div>
  );
});

Toolbar.displayName = 'Toolbar';

export default Toolbar;
