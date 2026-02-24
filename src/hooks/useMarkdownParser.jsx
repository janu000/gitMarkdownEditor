import { useState, useEffect, useCallback, useRef } from 'react';

export default function useMarkdownParser(showToast, setLoadingState) {
  const [parsedHtml, setParsedHtml] = useState('');
  const [tocHeadings, setTocHeadings] = useState([]);
  const workerRef = useRef(null);
  const pendingIdRef = useRef(0);

  useEffect(() => {
    // Load KaTeX CSS on main thread for the preview
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(link);
    }

    // Initialize Worker
    const worker = new Worker(new URL('../utils/markdownWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, html, toc, id, error } = e.data;
      if (type === 'success' && id === pendingIdRef.current) {
        setParsedHtml(html);
        if (toc) setTocHeadings(toc);
        setLoadingState('');
      } else if (type === 'error') {
        console.error("Worker error:", error);
        setLoadingState('Parsing error');
      } else if (type === 'ready') {
        console.log("Markdown Worker Ready");
      }
    };

    worker.postMessage({ type: 'init' });

    return () => {
      worker.terminate();
    };
  }, [setLoadingState]);

  const updateTOC = useCallback((fileContent, filePath) => {
    // Worker now handles TOC generation alongside HTML
  }, []);

  const updatePreview = useCallback(async (md, filePath = 'untitled.md') => {
    if (!workerRef.current) return;
    
    pendingIdRef.current++;
    setLoadingState('Syncing...');
    workerRef.current.postMessage({ 
      type: 'parse', 
      md, 
      id: pendingIdRef.current,
      filePath,
      generateToc: true 
    });
  }, [setLoadingState]);

  return {
    parsedHtml,
    tocHeadings,
    updateTOC,
    updatePreview
  };
}
