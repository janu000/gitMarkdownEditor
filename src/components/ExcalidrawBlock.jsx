import React, { useState, useEffect, useRef, memo, useCallback, useMemo, Component } from 'react';
import { Edit3, Check, Copy, CheckCheck, Trash2 } from 'lucide-react';
import ExcalidrawCanvas from './ExcalidrawCanvas';
import { exportSceneToSvg, parseExcalidrawContent, serializeToCodeBlock } from '../utils/excalidraw';

class ExcalidrawErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('Excalidraw error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-center text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">Canvas recovery mode</p>
          <p className="text-[11px] mb-2">{this.state.error?.message || 'Drawing engine encountered an issue'}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs transition"
          >
            Reload Canvas
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ExcalidrawBlock = memo(({
  rawCode,
  parsedData,
  autoEdit = false,
  onChange,
  onDelete,
  theme = 'light',
  isEditable = true,
  className = '',
}) => {
  const initialExternalData = useMemo(() => {
    return parsedData || parseExcalidrawContent(rawCode) || { elements: [], appState: { viewBackgroundColor: 'transparent' } };
  }, [parsedData, rawCode]);

  const [isEditing, setIsEditing] = useState(autoEdit);
  const latestDataRef = useRef(initialExternalData);
  const [svgElement, setSvgElement] = useState(null);
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(() => initialExternalData?.appState?.height || 420);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(420);
  const containerRef = useRef(null);
  const excalidrawAPIRef = useRef(null);

  // Sync height from external data when changed
  useEffect(() => {
    if (initialExternalData?.appState?.height && initialExternalData.appState.height !== height) {
      setHeight(initialExternalData.appState.height);
    }
  }, [initialExternalData?.appState?.height]);

  // Update latestDataRef when external props change and not currently editing
  useEffect(() => {
    if (!isEditing) {
      latestDataRef.current = initialExternalData;
    }
  }, [initialExternalData, isEditing]);

  // Generate SVG snapshot whenever initialExternalData changes, exiting editing, or theme changes
  useEffect(() => {
    if (isEditing) return;

    let isMounted = true;

    exportSceneToSvg(latestDataRef.current || initialExternalData, {
      theme: theme === 'dark' ? 'dark' : 'light',
      exportBackground: false,
      matchViewport: true,
      height: height,
      width: containerRef.current?.clientWidth || 800,
    })
      .then((svg) => {
        if (isMounted) {
          setSvgElement(svg);
        }
      })
      .catch((err) => {
        console.error('Failed to export Excalidraw SVG:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [initialExternalData, theme, isEditing, height]);

  const handleCanvasChange = useCallback((elements, appState, files) => {
    const currentWidth = containerRef.current?.clientWidth || appState?.width;
    const updated = {
      ...latestDataRef.current,
      elements,
      appState: {
        ...latestDataRef.current?.appState,
        ...appState,
        height: height,
        width: currentWidth || latestDataRef.current?.appState?.width,
      },
      files: files || latestDataRef.current?.files || {},
    };
    latestDataRef.current = updated;

    if (onChange) {
      const codeBlock = serializeToCodeBlock(updated);
      onChange(updated, codeBlock);
    }
  }, [onChange, height]);

  const handleDoneEditing = useCallback(() => {
    const api = excalidrawAPIRef.current;
    if (api) {
      try {
        const elements = api.getSceneElements?.();
        if (Array.isArray(elements)) {
          handleCanvasChange(
            elements,
            api.getAppState?.() || {},
            api.getFiles?.() || {},
          );
        }
      } catch (err) {
        console.warn('Could not capture the final Excalidraw viewport:', err);
      }
    }
    setIsEditing(false);
  }, [handleCanvasChange]);

  const handleCopySvg = async (e) => {
    e.stopPropagation();
    if (!svgElement) return;
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      await navigator.clipboard.writeText(svgString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SVG:', err);
    }
  };

  // Drag-to-resize canvas height
  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      const delta = moveEvent.clientY - startYRef.current;
      const newHeight = Math.max(260, Math.min(900, startHeightRef.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Reliable capture-phase double-click listener to open edit mode inside ProseMirror
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isEditing || !isEditable) return;

    const handleDblClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(true);
    };

    el.addEventListener('dblclick', handleDblClick, true);
    return () => {
      el.removeEventListener('dblclick', handleDblClick, true);
    };
  }, [isEditing, isEditable]);

  // Done button integrated inside the Excalidraw toolbar with vibrant blue styling
  const renderTopRightUI = useCallback(() => {
    return (
      <div className="flex items-center mr-2">
        <button
          type="button"
          onClick={handleDoneEditing}
          className="excalidraw-done-button"
          style={{
            height: '36px',
            padding: '0 14px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderRadius: '8px',
            border: '1px solid #1d4ed8',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
          title="Finish Editing (Done)"
        >
          <Check className="w-4 h-4 stroke-[2.5]" style={{ color: '#ffffff' }} />
          <span style={{ color: '#ffffff' }}>Done</span>
        </button>
      </div>
    );
  }, [handleDoneEditing]);

  if (isEditing) {
    return (
      <div
        ref={containerRef}
        style={{ height: `${height}px` }}
        className={`excalidraw-block-editing my-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117] shadow-lg ring-2 ring-blue-500/40 relative overflow-hidden ${className}`}
        contentEditable={false}
      >
        {/* Live Canvas occupying full container with native toolbar Done button */}
        <div className="w-full h-full relative">
          <ExcalidrawErrorBoundary onReset={() => setIsEditing(false)}>
            <ExcalidrawCanvas
              key="inplace-canvas"
              initialData={latestDataRef.current || initialExternalData}
              onChange={handleCanvasChange}
              excalidrawRef={excalidrawAPIRef}
              renderTopRightUI={renderTopRightUI}
              theme={theme}
              style={{ height: '100%', minHeight: '100%' }}
            />
          </ExcalidrawErrorBoundary>
          {/* Resize handle */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute bottom-0 left-0 right-0 h-3 bg-transparent hover:bg-blue-500/20 cursor-ns-resize flex items-center justify-center group/resizer z-30 transition"
            title="Drag to resize height"
          >
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full group-hover/resizer:bg-blue-500 transition" />
          </div>
        </div>
      </div>
    );
  }

  // Pure Rendered Mode (Zero borders, zero headers, pure diagram)
  return (
    <div
      ref={containerRef}
      onDoubleClick={() => isEditable && setIsEditing(true)}
      className={`excalidraw-block-view group relative my-6 p-0 flex justify-start w-full cursor-pointer select-none rounded-xl transition-colors ${
        isEditable ? 'hover:bg-gray-50/50 dark:hover:bg-[#161b22]/30' : ''
      } ${className}`}
      contentEditable={false}
      title={isEditable ? 'Double-click to edit diagram' : undefined}
    >
      {/* Compact contextual actions for the rendered drawing */}
      {isEditable && (
        <div className="excalidraw-floating-bar absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex h-8 items-center gap-0.5 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md border border-gray-200/90 dark:border-gray-700/90 rounded-md px-0.5 shadow-lg z-20">
          <button
            type="button"
            onClick={handleCopySvg}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
            title="Copy SVG"
          >
            {copied ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />}
          </button>

          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="flex h-6 items-center gap-1 rounded border border-blue-200/80 dark:border-blue-800/80 bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-600 shadow-xs transition hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 cursor-pointer"
            title="Edit Drawing"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
              title="Delete Diagram"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* SVG Output */}
      {svgElement ? (
        <div
          style={{ height: `${height}px` }}
          className="w-full flex justify-start overflow-hidden rounded-lg"
          dangerouslySetInnerHTML={{ __html: svgElement.outerHTML }}
        />
      ) : (
        <div style={{ height: `${height}px` }} className="flex items-center justify-center p-6 text-gray-400 space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Rendering diagram...</span>
        </div>
      )}
    </div>
  );
});

ExcalidrawBlock.displayName = 'ExcalidrawBlock';

export default ExcalidrawBlock;
