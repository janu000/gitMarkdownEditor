import React, { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, Keyboard, Save } from 'lucide-react';
import { formatShortcut, resetShortcuts, loadShortcuts, saveShortcut } from '../utils/shortcutManager';

const ShortcutModal = ({ show, onClose, onShortcutsUpdated }) => {
  const [shortcuts, setShortcuts] = useState(loadShortcuts());
  const [recordingAction, setRecordingAction] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      if (!recordingAction) {
        if (e.key === 'Escape') onClose();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Don't record just modifiers
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('mod');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());

      const newCombo = parts.join('+');
      const updated = { ...shortcuts, [recordingAction]: newCombo };
      setShortcuts(updated);
      saveShortcut(recordingAction, newCombo);
      setRecordingAction(null);
      onShortcutsUpdated(updated);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [show, recordingAction, shortcuts, onClose, onShortcutsUpdated]);

  if (!show) return null;

  const handleReset = () => {
    if (window.confirm('Reset all shortcuts to defaults?')) {
      resetShortcuts();
      const defaults = loadShortcuts();
      setShortcuts(defaults);
      onShortcutsUpdated(defaults);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <Keyboard className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 italic">
            Click on a shortcut to record a new key combination.
          </p>
          
          <div className="grid grid-cols-1 gap-1">
            {Object.entries(shortcuts).map(([action, combo]) => (
              <div 
                key={action} 
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  recordingAction === action 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20' 
                    : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {action.replace(/_/g, ' ')}
                </span>
                <button
                  onClick={() => setRecordingAction(action === recordingAction ? null : action)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all min-w-[100px] text-center ${
                    recordingAction === action
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {recordingAction === action ? 'Press keys...' : formatShortcut(combo)}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between bg-gray-50/50 dark:bg-gray-900/20">
          <button 
            onClick={handleReset}
            className="flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Reset Defaults
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutModal;
