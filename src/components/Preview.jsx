import React from 'react';

const Preview = ({ 
  viewMode, 
  splitRatio, 
  previewRef, 
  handleScroll, 
  parsedHtml,
  onClick
}) => {
  if (viewMode === 'edit') return null;

  return (
    <div 
      id="preview-container" 
      ref={previewRef} 
      onScroll={handleScroll} 
      onClick={onClick}
      className={`h-full bg-white dark:bg-[#0d1117] overflow-y-auto p-8 custom-scrollbar relative ${viewMode === 'split' ? '' : 'flex-1'}`} 
      style={viewMode === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : {}}
    >
      <div className="max-w-3xl mx-auto w-full">
        <div className="markdown-body text-gray-900 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: parsedHtml }} />
      </div>
    </div>
  );
};

export default Preview;
