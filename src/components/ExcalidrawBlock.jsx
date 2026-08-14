import React, { useState, useEffect, useRef, memo, useCallback, useMemo, Component } from 'react';
import { Edit3, Maximize2, Check, Copy, CheckCheck, Trash2 } from 'lucide-react';
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
  onOpenFullscreen,
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
  const [height, setHeight] = useState(420);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(420);
  const containerRef = useRef(null);

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

    exportSceneToSvg(initialExternalData, {
      theme: theme === 'dark' ? 'dark' : 'light',
      exportBackground: false,
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
  }, [initialExternalData, theme, isEditing]);

  const handleCanvasChange = useCallback((elements, appState, files) => {
    const updated = {
      ...latestDataRef.current,
      elements,
      appState: {
        ...latestDataRef.current?.appState,
        ...appState,
      },
      files: files || latestDataRef.current?.files || {},
    };
    latestDataRef.current = updated;

    if (onChange) {
      const codeBlock = serializeToCodeBlock(updated);
      onChange(updated, codeBlock);
    }
  }, [onChange]);

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

  if (isEditing) {
    return (
      <div
        ref={containerRef}
        className={`excalidraw-block-editing my-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117] shadow-lg ring-2 ring-blue-500/40 relative overflow-hidden ${className}`}
        contentEditable={false}
      >
        {/* Spacious top control bar in editing mode */}
        <div className="excalidraw-edit-header flex items-center justify-between px-6 py-3 min-h-[48px] bg-gray-50/95 dark:bg-[#161b22]/95 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 select-none">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-semibold text-xs shadow-xs">
              🎨
            </span>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-[13px] tracking-wide">
              Excalidraw Canvas
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
              Editing
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onOpenFullscreen && (
              <button
                type="button"
                onClick={() => onOpenFullscreen(latestDataRef.current)}
                className="btn-fullscreen-editing px-3.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                title="Expand to Fullscreen Modal"
              >
                <Maximize2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span>Fullscreen</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-done-editing px-4 py-1.5 text-xs font-semibold rounded-lg !bg-blue-600 hover:!bg-blue-700 !text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            >
              <Check className="w-4 h-4 !text-white stroke-[2.5]" />
              <span className="font-semibold !text-white">Done Editing</span>
            </button>
          </div>
        </div>

        {/* Live Canvas */}
        <div style={{ height: `${height}px` }} className="w-full relative">
          <ExcalidrawErrorBoundary onReset={() => setIsEditing(false)}>
            <ExcalidrawCanvas
              key="canvas-active"
              initialData={initialExternalData}
              onChange={handleCanvasChange}
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
      className={`excalidraw-block-view group relative my-6 p-4 flex justify-center w-full cursor-pointer select-none rounded-xl transition-colors ${
        isEditable ? 'hover:bg-gray-50/50 dark:hover:bg-[#161b22]/30' : ''
      } ${className}`}
      contentEditable={false}
      title={isEditable ? 'Double-click to edit diagram' : undefined}
    >
      {/* Spacious glassmorphic floating action overlay on hover with generous outside padding */}
      {isEditable && (
        <div className="excalidraw-floating-bar absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center space-x-2 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md border border-gray-200/90 dark:border-gray-700/90 rounded-xl px-3 py-1.5 shadow-xl z-20">
          <button
            type="button"
            onClick={handleCopySvg}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
            title="Copy SVG"
          >
            {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />}
          </button>

          {onOpenFullscreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFullscreen(latestDataRef.current);
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          )}

          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Edit Drawing"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
              title="Delete Diagram"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* SVG Output */}
      {svgElement ? (
        <div
          className="w-full flex justify-center overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: svgElement.outerHTML }}
        />
      ) : (
        <div className="flex items-center justify-center p-6 text-gray-400 space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Rendering diagram...</span>
        </div>
      )}
    </div>
  );
});

ExcalidrawBlock.displayName = 'ExcalidrawBlock';

export default ExcalidrawBlock;
