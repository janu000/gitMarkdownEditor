import React, { memo } from 'react';

const Preview = memo(({ 
  previewRef, 
  parsedHtml,
  onClick
}) => {
  return (
    <div 
      id="preview-container" 
      ref={previewRef} 
      onClick={onClick}
      className="h-full bg-white dark:bg-[#0d1117] overflow-y-auto p-8 custom-scrollbar relative w-full" 
    >
      <div className="max-w-3xl mx-auto w-full">
        <div className="markdown-body text-gray-900 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: parsedHtml }} />
      </div>
    </div>
  );
});

Preview.displayName = 'Preview';

export default Preview;
