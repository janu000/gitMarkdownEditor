import React, { memo, useEffect } from 'react';
import { exportSceneToSvg, parseExcalidrawContent } from '../utils/excalidraw';

const Preview = memo(({ 
  previewRef, 
  parsedHtml,
  onClick,
  theme = 'light',
}) => {
  useEffect(() => {
    const container = previewRef?.current;
    if (!container) return;

    // Find all excalidraw code blocks in the rendered markdown HTML
    const codeBlocks = container.querySelectorAll(
      'pre > code.language-excalidraw, pre > code.language-json\\:excalidraw'
    );

    codeBlocks.forEach((codeEl) => {
      const preEl = codeEl.parentElement;
      if (!preEl) return;

      const rawCode = codeEl.textContent || '';
      const parsed = parseExcalidrawContent(rawCode);
      if (!parsed) return;

      // Hide the raw pre block
      preEl.style.display = 'none';

      // Check if mount container already exists
      let mountEl = preEl.nextElementSibling;
      if (!mountEl || !mountEl.classList.contains('excalidraw-preview-mount')) {
        mountEl = document.createElement('div');
        mountEl.className = 'excalidraw-preview-mount my-6 flex justify-start w-full select-none';
        preEl.parentNode.insertBefore(mountEl, preEl.nextSibling);
      }

      mountEl.innerHTML = `
        <div class="excalidraw-rendered-diagram flex justify-start w-full overflow-x-auto">
          <div class="svg-host-area flex justify-start w-full max-w-full">
            <div class="text-xs text-gray-400 py-4">Rendering diagram...</div>
          </div>
        </div>
      `;

      const svgHost = mountEl.querySelector('.svg-host-area');

      exportSceneToSvg(parsed, {
        theme: theme === 'dark' ? 'dark' : 'light',
        exportBackground: false,
        matchViewport: true,
        height: parsed.appState?.height || 420,
        width: container.clientWidth || 768,
      })
        .then((svg) => {
          if (svgHost) {
            svgHost.innerHTML = '';
            svg.classList.add('max-w-full', 'h-auto');
            svgHost.appendChild(svg);
          }
        })
        .catch((err) => {
          console.error('Failed to render Excalidraw SVG in preview:', err);
          if (svgHost) {
            svgHost.innerHTML = '<div class="text-xs text-red-500 py-2">Failed to render diagram</div>';
          }
        });
    });
  }, [parsedHtml, theme, previewRef]);

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
