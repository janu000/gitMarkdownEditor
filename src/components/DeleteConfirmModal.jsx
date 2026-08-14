import React, { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, X, Folder, FileText, Palette, GitBranch } from 'lucide-react';
import { isExcalidrawFile } from '../utils/excalidraw';
import { getDisplayName } from '../utils/markdown';

export default function DeleteConfirmModal({
  isOpen,
  file,
  currentRepo = null,
  currentBranch = null,
  onClose,
  onConfirm
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => {
      if (cancelButtonRef.current) {
        cancelButtonRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const isFolder = file.type === 'dir';
  const isDrawing = !isFolder && isExcalidrawFile(file.name);
  const displayName = isFolder ? file.name : (isDrawing ? file.name : getDisplayName(file.name));
  const fullFileName = file.name;
  const filePath = file.path || file.name;

  const getItemIcon = () => {
    if (isFolder) return <Folder className="w-5 h-5 text-amber-500 shrink-0" />;
    if (isDrawing) return <Palette className="w-5 h-5 text-indigo-500 shrink-0" />;
    return <FileText className="w-5 h-5 text-blue-500 shrink-0" />;
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    onConfirm(file);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-[#0d1117]/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-modal-title" className="text-base font-semibold text-gray-900 dark:text-white">
                {isFolder ? 'Delete Folder' : 'Delete File'}
              </h2>
              <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
                {currentRepo ? (
                  <>
                    <GitBranch className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-mono truncate max-w-[200px]">
                      {currentRepo} {currentBranch ? `(${currentBranch})` : ''}
                    </span>
                  </>
                ) : (
                  <span>Local Workspace</span>
                )}
              </div>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong className="font-mono text-gray-900 dark:text-white font-semibold">{displayName}</strong>?
          </p>

          {/* Item details card */}
          <div className="p-3.5 bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-200/80 dark:border-gray-800/80 flex items-center space-x-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/60 dark:border-gray-700 shadow-sm">
              {getItemIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono truncate">
                {fullFileName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                /{filePath}
              </div>
            </div>
          </div>

          {/* Warning banner */}
          <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
            <div>
              <span className="font-medium">Permanent Action:</span>{' '}
              {isFolder
                ? 'This will permanently remove the folder and all its contents from your workspace.'
                : 'This action cannot be undone. The file will be permanently removed.'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-medium rounded-xl shadow-sm transition-all flex items-center space-x-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isFolder ? 'Delete Folder' : 'Delete File'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
