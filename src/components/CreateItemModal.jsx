import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Folder, FilePlus, FolderPlus, FileEdit, GitBranch, Sparkles } from 'lucide-react';
import { ensureMarkdownExtension } from '../utils/markdown';

export default function CreateItemModal({
  isOpen,
  mode = 'file', // 'file' | 'folder' | 'rename' | 'branch'
  initialValue = '',
  parentPath = null,
  onClose,
  onSubmit
}) {
  const [itemType, setItemType] = useState(mode === 'folder' ? 'folder' : 'file');
  const [name, setName] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (mode === 'rename' && initialValue) {
          // Select without extension if present
          const dotIdx = initialValue.lastIndexOf('.');
          if (dotIdx > 0) {
            inputRef.current.setSelectionRange(0, dotIdx);
          } else {
            inputRef.current.select();
          }
        } else {
          inputRef.current.select();
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, mode, initialValue]);

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

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (mode === 'rename') {
      onSubmit(name.trim());
    } else if (mode === 'branch') {
      onSubmit(name.trim());
    } else {
      // Create mode (file vs folder)
      onSubmit(name.trim(), itemType, parentPath);
    }
    onClose();
  };

  const isFile = mode !== 'rename' && mode !== 'branch' && itemType === 'file';
  const formattedPreview = isFile && name.trim() ? ensureMarkdownExtension(name.trim()) : '';

  const getTitle = () => {
    if (mode === 'rename') return 'Rename Item';
    if (mode === 'branch') return 'Create New Branch';
    return itemType === 'folder' ? 'Create New Folder' : 'Create New File';
  };

  const getIcon = () => {
    if (mode === 'rename') return <FileEdit className="w-5 h-5 text-indigo-500" />;
    if (mode === 'branch') return <GitBranch className="w-5 h-5 text-indigo-500" />;
    return itemType === 'folder' 
      ? <FolderPlus className="w-5 h-5 text-indigo-500" />
      : <FilePlus className="w-5 h-5 text-indigo-500" />;
  };

  const handleQuickExtension = (ext) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(`untitled${ext}`);
      return;
    }
    const lastPart = trimmed.split('/').pop();
    const dotIdx = lastPart.lastIndexOf('.');
    if (dotIdx > 0) {
      const base = trimmed.substring(0, trimmed.lastIndexOf('.'));
      setName(`${base}${ext}`);
    } else {
      setName(`${trimmed}${ext}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-[#0d1117]/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {getTitle()}
              </h2>
              {parentPath && (
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[220px]">
                  in /{parentPath}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Mode Switcher for creation */}
          {mode !== 'rename' && mode !== 'branch' && (
            <div className="flex p-1 bg-gray-100 dark:bg-[#0d1117] rounded-xl border border-gray-200/60 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setItemType('file')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition-all ${
                  itemType === 'file'
                    ? 'bg-white dark:bg-[#161b22] text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>File</span>
              </button>
              <button
                type="button"
                onClick={() => setItemType('folder')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition-all ${
                  itemType === 'folder'
                    ? 'bg-white dark:bg-[#161b22] text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Folder</span>
              </button>
            </div>
          )}

          {/* Main Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {mode === 'branch' ? 'Branch Name' : itemType === 'folder' ? 'Folder Name' : 'File Name'}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                mode === 'branch'
                  ? 'feature/my-branch'
                  : itemType === 'folder'
                  ? 'my-folder'
                  : 'my-file-name'
              }
              className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
            />
          </div>

          {/* Quick Extensions for Files */}
          {isFile && (
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">Preset extensions:</span>
                {['.md', '.txt'].map((ext) => (
                  <button
                    key={ext}
                    type="button"
                    onClick={() => handleQuickExtension(ext)}
                    className="px-2 py-0.5 text-[11px] font-mono rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                  >
                    {ext}
                  </button>
                ))}
              </div>

              {formattedPreview && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">
                    Creates: <strong className="font-mono">{formattedPreview}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <span>
                {mode === 'rename'
                  ? 'Rename'
                  : mode === 'branch'
                  ? 'Create Branch'
                  : itemType === 'folder'
                  ? 'Create Folder'
                  : 'Create File'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
