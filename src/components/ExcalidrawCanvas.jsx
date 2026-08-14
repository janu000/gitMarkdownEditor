import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import '@excalidraw/excalidraw/index.css';

/**
 * ExcalidrawCanvas component
 * Lazy loads and mounts the full Excalidraw canvas inside a responsive container.
 * Isolates initialData and debounces onChange to prevent React render loops.
 */
const ExcalidrawCanvas = memo(({
  initialData,
  onChange,
  theme = 'light',
  zenModeEnabled = false,
  gridModeEnabled = false,
  viewModeEnabled = false,
  className = '',
  style = {},
}) => {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Capture initialData ONCE when canvas component is instantiated
  // Passing a new object reference to Excalidraw on every render triggers infinite update loops!
  const initialDataRef = useRef(null);
  if (!initialDataRef.current) {
    const rawAppState = initialData?.appState || {};
    const { collaborators, ...cleanAppState } = rawAppState;
    initialDataRef.current = {
      elements: initialData?.elements ? JSON.parse(JSON.stringify(initialData.elements)) : [],
      appState: {
        theme: theme === 'dark' ? 'dark' : 'light',
        viewBackgroundColor: cleanAppState.viewBackgroundColor || (theme === 'dark' ? '#121212' : '#ffffff'),
        zenModeEnabled,
        gridModeEnabled,
        viewModeEnabled,
        ...cleanAppState,
        collaborators: collaborators instanceof Map ? collaborators : new Map(),
      },
      files: initialData?.files ? JSON.parse(JSON.stringify(initialData.files)) : {},
    };
  }

  // Dynamically load Excalidraw component
  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined' && !window.EXCALIDRAW_ASSET_PATH) {
      window.EXCALIDRAW_ASSET_PATH = '/';
    }
    import('@excalidraw/excalidraw')
      .then((mod) => {
        if (isMounted) {
          setExcalidrawComponent(() => mod.Excalidraw);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load @excalidraw/excalidraw', err);
          setError(err.message || 'Failed to load Excalidraw engine');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Update theme when changed
  useEffect(() => {
    if (excalidrawAPI) {
      try {
        excalidrawAPI.updateScene({
          appState: {
            theme: theme === 'dark' ? 'dark' : 'light',
          },
        });
      } catch (e) {
        console.warn('Could not update Excalidraw scene theme', e);
      }
    }
  }, [theme, excalidrawAPI]);

  // Isolate keyboard and mouse events so ProseMirror / CodeMirror don't capture them
  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // Debounced onChange to prevent infinite React render loops and high-frequency updates
  const handleChange = useCallback((elements, appState, files) => {
    if (!onChangeRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChangeRef.current?.(elements, appState, files);
    }, 200);
  }, []);

  if (loading) {
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-lg p-8 ${className}`}
        style={{ minHeight: '320px', ...style }}
      >
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading Excalidraw canvas...</p>
      </div>
    );
  }

  if (error || !ExcalidrawComponent) {
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center ${className}`}
        style={{ minHeight: '200px', ...style }}
      >
        <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Canvas Error</p>
        <p className="text-xs text-red-500 dark:text-red-300">{error || 'Could not initialize drawing component'}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      className={`excalidraw-wrapper relative w-full h-full overflow-hidden select-none ${className}`}
      style={{ minHeight: '380px', ...style }}
    >
      <ExcalidrawComponent
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialDataRef.current}
        onChange={handleChange}
        theme={theme === 'dark' ? 'dark' : 'light'}
        viewModeEnabled={viewModeEnabled}
        zenModeEnabled={zenModeEnabled}
        gridModeEnabled={gridModeEnabled}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            saveToActiveFile: false,
            theme: true,
            saveAsImage: true,
          },
        }}
      />
    </div>
  );
});

ExcalidrawCanvas.displayName = 'ExcalidrawCanvas';

export default ExcalidrawCanvas;
