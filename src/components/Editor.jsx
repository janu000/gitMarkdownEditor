import React, { memo, useState, useEffect, useRef, useCallback } from 'react';

const Editor = memo(({ 
  viewMode, 
  splitRatio, 
  editorRef, 
  content, 
  setContent, 
  handleScroll,
  onKeyUp,
  onSelect,
  onClick
}) => {
  const [localContent, setLocalContent] = useState(content);
  const lastPushedContentRef = useRef(content);

  // Sync from parent if content changes externally (e.g. file load, formatting)
  useEffect(() => {
    if (content !== lastPushedContentRef.current) {
      setLocalContent(content);
      lastPushedContentRef.current = content;
    }
  }, [content]);

  // Sync to parent with debounce to avoid excessive App re-renders
  useEffect(() => {
    if (localContent === content) return;

    const handler = setTimeout(() => {
      lastPushedContentRef.current = localContent;
      setContent(localContent);
    }, 100);

    return () => clearTimeout(handler);
  }, [localContent, setContent, content]);

  const handleBlur = useCallback(() => {
    if (localContent !== content) {
      lastPushedContentRef.current = localContent;
      setContent(localContent);
    }
  }, [localContent, content, setContent]);

  if (viewMode === 'preview') return null;

  return (
    <div 
      id="editor-container" 
      className={`h-full flex flex-col bg-white dark:bg-[#0d1117] ${viewMode === 'split' ? '' : 'flex-1'}`} 
      style={viewMode === 'split' ? { width: `${splitRatio * 100}%` } : {}}
    >
      <textarea
        ref={editorRef}
        value={localContent}
        onChange={(e) => setLocalContent(e.target.value)}
        onBlur={handleBlur}
        onScroll={handleScroll}
        onKeyUp={onKeyUp}
        onSelect={onSelect}
        onClick={onClick}
        className="flex-1 w-full bg-transparent text-gray-900 dark:text-gray-300 font-mono text-sm leading-relaxed p-6 resize-none focus:outline-none custom-scrollbar"
        placeholder="Start typing your markdown here..."
        spellCheck="false"
      />
    </div>
  );
});

Editor.displayName = 'Editor';

export default Editor;
