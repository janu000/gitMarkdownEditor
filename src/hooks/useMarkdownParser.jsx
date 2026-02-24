import { useState, useEffect, useCallback, useRef } from 'react';

export default function useMarkdownParser(showToast, setLoadingState) {
  const [parsedHtml, setParsedHtml] = useState('');
  const [tocHeadings, setTocHeadings] = useState([]);
  const [isExpensive, setIsExpensive] = useState(false);
  const workerRef = useRef(null);
  const pendingIdRef = useRef(0);

  useEffect(() => {
    // ... (KaTeX CSS logic remains same)

    // Initialize Worker
    const worker = new Worker(new URL('../utils/markdownWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, html, toc, id, error, duration } = e.data;
      if (type === 'success' && id === pendingIdRef.current) {
        setParsedHtml(html);
        if (toc) setTocHeadings(toc);
        setLoadingState('');
        
        // If parsing takes longer than 60ms, mark it as expensive
        if (duration > 60) {
          setIsExpensive(true);
        } else if (duration < 30) {
          setIsExpensive(false);
        }
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
    if (!workerRef.current) return;
    workerRef.current.postMessage({ 
      type: 'parse', 
      md: fileContent, 
      id: pendingIdRef.current, // Use current id or a special one
      filePath,
      generateToc: true 
    });
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
    isExpensive,
    updateTOC,
    updatePreview
  };
}
