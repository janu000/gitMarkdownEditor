import { useEffect, useRef, useCallback } from 'react';
import { EditorView } from 'codemirror';

export default function useSyncScroll(editorRef, previewRef, active, parsedHtml) {
  const isScrollingEditor = useRef(false);
  const isScrollingPreview = useRef(false);
  const scrollTimeout = useRef(null);
  
  // Cache for preview element offsets
  const previewElementsCache = useRef([]);

  const lastUpdateTime = useRef(0);
  const updateTimeout = useRef(null);

  const updatePreviewCache = useCallback(() => {
    if (!previewRef.current || !editorRef.current) return;
    
    // Skip updates during active scrolling to prevent layout thrashing
    if (isScrollingEditor.current || isScrollingPreview.current) {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      updateTimeout.current = setTimeout(updatePreviewCache, 200);
      return;
    }

    // Debounce the cache update to avoid rapid re-calculations
    const now = Date.now();
    if (now - lastUpdateTime.current < 500) {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      updateTimeout.current = setTimeout(updatePreviewCache, 500);
      return;
    }
    lastUpdateTime.current = now;

    // Use requestAnimationFrame to ensure the DOM has been painted before we measure it
    requestAnimationFrame(async () => {
      if (!previewRef.current || !editorRef.current) return;
      
      const container = previewRef.current;
      const view = editorRef.current;
      const containerRect = container.getBoundingClientRect();
      const elements = Array.from(container.querySelectorAll('[data-offset-start]'));
      
      if (elements.length === 0) return;

      const newCache = [];
      const batchSize = 100; // Process in small batches to keep the UI responsive
      
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const rect = el.getBoundingClientRect();
        newCache.push({
          offset: parseInt(el.getAttribute('data-offset-start'), 10),
          top: rect.top - containerRect.top + container.scrollTop,
        });

        // Yield to the main thread every batchSize elements
        if (i > 0 && i % batchSize === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      newCache.sort((a, b) => a.offset - b.offset);

      // Strictly Monotonic Filter: ensure both offset AND top are strictly increasing
      const docLength = view.state.doc.length;
      const scrollHeight = container.scrollHeight - container.clientHeight;

      const filtered = [{ offset: 0, top: 0 }];
      let last = filtered[0];

      for (const current of newCache) {
        // Only add points that progress both position and offset
        if (current.offset > last.offset && current.top > last.top) {
          filtered.push(current);
          last = current;
        }
      }

      // Ensure the final point is the end of document
      if (docLength > last.offset && scrollHeight > last.top) {
        filtered.push({ offset: docLength, top: scrollHeight });
      } else {
        // Update the last point to be the true bottom if it's close
        last.offset = docLength;
        last.top = scrollHeight;
      }

      previewElementsCache.current = filtered;
    });
  }, [previewRef, editorRef]);

  const clearScrollingFlags = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrollingEditor.current = false;
      isScrollingPreview.current = false;
    }, 150);
  }, []);

  const handleEditorScroll = useCallback((view) => {
    if (!active || isScrollingPreview.current || !previewRef.current) return;

    isScrollingEditor.current = true;
    clearScrollingFlags();

    const cache = previewElementsCache.current;
    if (cache.length < 2) return;

    const scrollDOM = view.scrollDOM;
    const rect = scrollDOM.getBoundingClientRect();
    const previewContainer = previewRef.current;
    const previewHeight = previewContainer.clientHeight;
    
    // Average over multiple anchors covering the entire viewport (0% to 100%)
    const sampleRatios = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    let sumTargetScrollTop = 0;

    sampleRatios.forEach(r => {
      const centerY = rect.top + rect.height * r;
      // Clamp Y to be within the viewport bounds for better accuracy at edges
      const clampedY = Math.max(rect.top, Math.min(rect.bottom - 1, centerY));
      const pos = view.posAtCoords({ x: rect.left + 50, y: clampedY }, false) || 0;

      // Binary search for the segment [p1, p2] containing pos
      let low = 0, high = cache.length - 2;
      let idx = 0;
      while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (cache[mid].offset <= pos) {
          idx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const p1 = cache[idx];
      const p2 = cache[idx + 1];
      const ratio = (pos - p1.offset) / (p2.offset - p1.offset);
      const targetTop = p1.top + ratio * (p2.top - p1.top);
      
      sumTargetScrollTop += (targetTop - r * previewHeight);
    });

    previewContainer.scrollTo({
      top: sumTargetScrollTop / sampleRatios.length,
      behavior: 'auto'
    });
  }, [active, previewRef, clearScrollingFlags]);

  const handlePreviewScroll = useCallback(() => {
    if (!active || isScrollingEditor.current || !editorRef.current || !previewRef.current) return;

    isScrollingPreview.current = true;
    clearScrollingFlags();

    const cache = previewElementsCache.current;
    if (cache.length < 2) return;

    const previewContainer = previewRef.current;
    const previewHeight = previewContainer.clientHeight;
    const view = editorRef.current;
    const editorHeight = view.scrollDOM.clientHeight;
    
    // Average over multiple anchors covering the entire viewport (0% to 100%)
    const sampleRatios = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    let sumTargetEditorTop = 0;

    sampleRatios.forEach(r => {
      const centerScrollTop = previewContainer.scrollTop + previewHeight * r;

      // Binary search for the segment [p1, p2] containing centerScrollTop
      let low = 0, high = cache.length - 2;
      let idx = 0;
      while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (cache[mid].top <= centerScrollTop) {
          idx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const p1 = cache[idx];
      const p2 = cache[idx + 1];
      const ratio = (centerScrollTop - p1.top) / (p2.top - p1.top);
      const targetOffset = p1.offset + ratio * (p2.offset - p1.offset);

      if (view instanceof EditorView) {
        const docLength = view.state.doc.length;
        const lineBlock = view.lineBlockAt(Math.min(docLength, Math.floor(targetOffset)));
        sumTargetEditorTop += (lineBlock.top - r * editorHeight);
      }
    });

    view.scrollDOM.scrollTo({
      top: sumTargetEditorTop / sampleRatios.length,
      behavior: 'auto'
    });
  }, [active, editorRef, clearScrollingFlags]);

  useEffect(() => {
    const view = editorRef.current;
    const preview = previewRef.current;

    if (!active || !view || !preview) {
      previewElementsCache.current = [];
      return;
    }

    // Update cache when content might have changed (actually we should trigger this when parsedHtml changes)
    updatePreviewCache();

    const editorScrollHandler = () => handleEditorScroll(view);
    const previewScrollHandler = () => handlePreviewScroll();

    view.scrollDOM.addEventListener('scroll', editorScrollHandler, { passive: true });
    preview.addEventListener('scroll', previewScrollHandler, { passive: true });

    // Use ResizeObserver to detect layout changes (including image loads that change size)
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updatePreviewCache, 100);
    });
    resizeObserver.observe(preview);

    // Also listen for 'load' events (for images) which might not trigger ResizeObserver in all cases
    const loadHandler = (e) => {
      if (e.target.tagName === 'IMG') {
        updatePreviewCache();
      }
    };
    preview.addEventListener('load', loadHandler, { capture: true });

    return () => {
      view.scrollDOM.removeEventListener('scroll', editorScrollHandler);
      preview.removeEventListener('scroll', previewScrollHandler);
      resizeObserver.disconnect();
      preview.removeEventListener('load', loadHandler, { capture: true });
      clearTimeout(resizeTimeout);
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
    };
  }, [active, editorRef.current, previewRef.current, handleEditorScroll, handlePreviewScroll, updatePreviewCache, parsedHtml]);
}
