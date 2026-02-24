import { useEffect, useRef, useCallback } from 'react';
import { EditorView } from 'codemirror';

export default function useSyncScroll(editorRef, previewRef, active) {
  const isScrollingEditor = useRef(false);
  const isScrollingPreview = useRef(false);
  const scrollTimeout = useRef(null);
  
  // Cache for preview element offsets
  const previewElementsCache = useRef([]);

  const updatePreviewCache = useCallback(() => {
    if (!previewRef.current || !editorRef.current) return;
    const container = previewRef.current;
    const view = editorRef.current;
    const containerRect = container.getBoundingClientRect();
    const elements = container.querySelectorAll('[data-offset-start]');
    
    let rawCache = Array.from(elements).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        offset: parseInt(el.getAttribute('data-offset-start'), 10),
        top: rect.top - containerRect.top + container.scrollTop,
      };
    }).sort((a, b) => a.offset - b.offset);

    // Strictly Monotonic Filter: ensure both offset AND top are strictly increasing
    const docLength = view.state.doc.length;
    const scrollHeight = container.scrollHeight - container.clientHeight;

    const filtered = [{ offset: 0, top: 0 }];
    let last = filtered[0];

    for (const current of rawCache) {
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

    const scrollDOM = view.scrollDOM;
    const scrollTop = scrollDOM.scrollTop;
    
    // Get the position at the visual top of the editor viewport
    // We add a small offset (5px) to ensure we get the character actually at the top
    const rect = scrollDOM.getBoundingClientRect();
    const pos = view.posAtCoords({ x: rect.left + 50, y: rect.top + 5 }, false) || 0;

    const cache = previewElementsCache.current;
    if (cache.length < 2) return;
    
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

    // Linearly interpolate
    const ratio = (pos - p1.offset) / (p2.offset - p1.offset);
    const targetTop = p1.top + ratio * (p2.top - p1.top);

    previewRef.current.scrollTo({
      top: targetTop,
      behavior: 'auto'
    });
  }, [active, previewRef, clearScrollingFlags]);

  const handlePreviewScroll = useCallback(() => {
    if (!active || isScrollingEditor.current || !editorRef.current || !previewRef.current) return;

    isScrollingPreview.current = true;
    clearScrollingFlags();

    const previewContainer = previewRef.current;
    const scrollTop = previewContainer.scrollTop;

    const cache = previewElementsCache.current;
    if (cache.length < 2) return;

    // Binary search for the segment [p1, p2] containing scrollTop
    let low = 0, high = cache.length - 2;
    let idx = 0;
    while (low <= high) {
      let mid = Math.floor((low + high) / 2);
      if (cache[mid].top <= scrollTop) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const p1 = cache[idx];
    const p2 = cache[idx + 1];

    // Linearly interpolate
    const ratio = (scrollTop - p1.top) / (p2.top - p1.top);
    const targetOffset = p1.offset + ratio * (p2.offset - p1.offset);

    const view = editorRef.current;
    if (view instanceof EditorView) {
      const lineBlock = view.lineBlockAt(Math.min(view.state.doc.length, Math.floor(targetOffset)));
      view.scrollDOM.scrollTo({
        top: lineBlock.top,
        behavior: 'auto'
      });
    }
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

    // MutationObserver to update cache when preview content changes
    let mutationTimeout;
    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(updatePreviewCache, 100);
    });
    observer.observe(preview, { childList: true, subtree: true });

    return () => {
      view.scrollDOM.removeEventListener('scroll', editorScrollHandler);
      preview.removeEventListener('scroll', previewScrollHandler);
      observer.disconnect();
      clearTimeout(mutationTimeout);
    };
  }, [active, editorRef.current, previewRef.current, handleEditorScroll, handlePreviewScroll, updatePreviewCache]);
}
