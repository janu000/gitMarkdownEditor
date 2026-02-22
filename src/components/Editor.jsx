import React from 'react';

const Editor = ({ 
  viewMode, 
  splitRatio, 
  editorRef, 
  content, 
  setContent, 
  handleScroll 
}) => {
  if (viewMode === 'preview') return null;

  return (
    <div 
      id="editor-container" 
      className={`h-full flex flex-col bg-white dark:bg-[#0d1117] ${viewMode === 'split' ? '' : 'flex-1'}`} 
      style={viewMode === 'split' ? { width: `${splitRatio * 100}%` } : {}}
    >
      <textarea
        ref={editorRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onScroll={handleScroll}
        className="flex-1 w-full bg-transparent text-gray-900 dark:text-gray-300 font-mono text-sm leading-relaxed p-6 resize-none focus:outline-none custom-scrollbar"
        placeholder="Start typing your markdown here..."
        spellCheck="false"
      />
    </div>
  );
};

export default Editor;
