import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import ExcalidrawCanvas from './ExcalidrawCanvas';
import { createDefaultExcalidrawScene } from '../utils/excalidraw';

export default function ExcalidrawModal({
  isOpen,
  initialData,
  onSave,
  onClose,
  theme = 'light',
  title = 'Excalidraw Drawing Editor',
}) {
  const [sceneData, setSceneData] = useState(() => initialData || createDefaultExcalidrawScene());
  const [isDirty, setIsDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (!isDirty || window.confirm('Discard unsaved drawing changes?')) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, onClose]);

  const handleCanvasChange = useCallback((elements, appState, files) => {
    setSceneData((prev) => ({
      ...prev,
      elements,
      appState: {
        ...prev?.appState,
        ...appState,
      },
      files: files || prev?.files || {},
    }));
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    if (onSave) {
      onSave(sceneData);
    }
    onClose();
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire canvas?')) {
      setSceneData(createDefaultExcalidrawScene());
      setIsDirty(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div
        ref={modalRef}
        className={`flex flex-col bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-screen h-screen rounded-none !p-0 !m-0 fixed inset-0' : 'w-full max-w-6xl h-[88vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🎨</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Sketch diagrams, workflows, and mindmaps</p>
            </div>
            {isDirty && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center gap-1.5 transition"
              title="Clear Canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 relative w-full h-full min-h-0 bg-gray-100 dark:bg-[#090d13]">
          <ExcalidrawCanvas
            initialData={sceneData}
            onChange={handleCanvasChange}
            theme={theme}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
