import React, { memo } from 'react';
import { 
  Columns, Sun, Moon, PenLine, Eye, Download, Printer, Save, Loader2, Code2, Highlighter, FileText, Type
} from 'lucide-react';
import { formatShortcut } from '../utils/shortcutManager';
import { getDisplayName } from '../utils/markdown';

const Toolbar = memo(({
  isSidebarOpen,
  setIsSidebarOpen,
  activeFile,
  currentRepo,
  currentBranch,
  localFileName,
  theme,
  setTheme,
  viewMode,
  setViewMode,
  handleDownload,
  handleExportPdf,
  saveToGitHub,
  isModified,
  loadingState,
  shortcuts,
  editorMode,
  setEditorMode,
  showFormattingTools,
  setShowFormattingTools
}) => {
  return (
    <div id="top-toolbar" className="h-11 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center space-x-2">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors mr-2">
          <Columns className="w-5 h-5" />
        </button>
        <div className="flex items-center text-sm">
          {activeFile ? (
            <>
              {activeFile.repo && currentRepo && <span className="text-gray-500">{currentRepo} ({currentBranch}) / </span>}
              {!activeFile.repo && <span className="text-gray-500 italic">Local / </span>}
              <span className="text-gray-900 dark:text-gray-200 ml-1 font-medium">{getDisplayName(activeFile.name)}</span>
              {isModified && <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" title="Unsaved changes"></span>}
            </>
          ) : localFileName ? (
            <>
              <span className="text-gray-500 italic">Local / </span>
              <span className="text-gray-900 dark:text-gray-200 ml-1 font-medium">{getDisplayName(localFileName)}</span>
            </>
          ) : (
            <span className="text-gray-500 italic">Local Draft (Unsynced)</span>
          )}

          {loadingState === 'fetching' && (
            <span className="ml-3 flex items-center gap-1 text-[11px] text-gray-500 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Syncing...
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button onClick={() => setShowFormattingTools(!showFormattingTools)} className={`p-1.5 rounded transition-colors mr-2 ${showFormattingTools ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800'}`} title="Toggle Formatting Tools">
          <Type className="w-5 h-5" />
        </button>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        {viewMode !== 'preview' && (
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-md p-0.5 border border-gray-300 dark:border-gray-700 mr-2" role="group" aria-label="Editor type">
            <button
              onClick={() => setEditorMode('visual')}
              aria-pressed={editorMode === 'visual'}
              className={`inline-flex h-7 w-7 items-center justify-center rounded transition-all ${editorMode === 'visual' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              title="Visual editor"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditorMode('source')}
              aria-pressed={editorMode === 'source'}
              className={`inline-flex h-7 w-7 items-center justify-center rounded transition-all ${editorMode === 'source' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              title="Markdown source editor"
            >
              <Code2 className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-2 mr-4"></div>
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-md p-0.5 border border-gray-300 dark:border-gray-700 mr-4" role="group" aria-label="Document view">
          <button onClick={() => setViewMode('edit')} aria-pressed={viewMode === 'edit'} className={`inline-flex h-7 w-7 items-center justify-center rounded transition-all ${viewMode === 'edit' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} title="Write">
            <PenLine className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('split')} aria-pressed={viewMode === 'split'} className={`inline-flex h-7 w-7 items-center justify-center rounded transition-all ${viewMode === 'split' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} title="Split">
            <Columns className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('preview')} aria-pressed={viewMode === 'preview'} className={`inline-flex h-7 w-7 items-center justify-center rounded transition-all ${viewMode === 'preview' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} title="Preview">
            <Eye className="w-4 h-4" />
          </button>
        </div>
        <button onClick={handleDownload} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2" title="Download File"><Download className="w-5 h-5" /></button>
        <button onClick={handleExportPdf} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2" title={`Export to PDF (${formatShortcut(shortcuts.print)})`}><Printer className="w-5 h-5" /></button>
        {currentRepo && (
          <button onClick={saveToGitHub} disabled={!activeFile || loadingState === 'saving'} title={activeFile ? `Commit (${formatShortcut(shortcuts.save)})` : 'No file to commit'} className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeFile ? 'bg-gradient-to-br from-[#6158ff] to-[#b772fe] hover:opacity-90 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
            {loadingState === 'saving' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Commit
          </button>
        )}
      </div>
    </div>
  );
});

Toolbar.displayName = 'Toolbar';

export default Toolbar;
