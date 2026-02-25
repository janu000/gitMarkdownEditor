import { useEffect, useRef, useCallback } from 'react';

/**
 * Linear Interpolation helper
 */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * High-precision bi-directional scroll synchronization.
 * Uses scroller-relative coordinates to eliminate layout drift.
 */
export default function useSyncScroll(editorRef, previewRef, active, parsedHtml) {
  const isScrollingEditor = useRef(false);
  const isScrollingPreview = useRef(false);
  const scrollTimeout = useRef(null);
  const updateTimeout = useRef(null);
  
  // Cache for anchor points mapped between scroller coordinate systems
  const syncCache = useRef(null);

  const updateSyncCache = useCallback(() => {
    if (!previewRef.current || !editorRef.current) return;
    
    // Clear any pending updates
    if (updateTimeout.current) clearTimeout(updateTimeout.current);

    // Skip updates during active scrolling to prevent layout thrashing
    if (isScrollingEditor.current || isScrollingPreview.current) {
      updateTimeout.current = setTimeout(updateSyncCache, 200);
      return;
    }

    requestAnimationFrame(() => {
      const preview = previewRef.current;
      const view = editorRef.current;
      if (!preview || !view) return;

      const previewRect = preview.getBoundingClientRect();
      const elements = Array.from(preview.querySelectorAll('[data-offset-start]'));
      if (elements.length === 0) return;

      const editorTopOffset = view.contentDOM.offsetTop || 0;
      const docLength = view.state.doc.length;

      const anchors = [];
      for (const el of elements) {
        const offset = Math.min(parseInt(el.getAttribute('data-offset-start'), 10), docLength);
        const rect = el.getBoundingClientRect();
        
        try {
          const line = view.lineBlockAt(offset);
          anchors.push({
            editorTop: line.top + editorTopOffset,
            previewTop: rect.top - previewRect.top + preview.scrollTop,
          });
        } catch (e) {
          // Ignore lines that can't be measured
        }
      }

      // Sort and filter for strict monotonicity
      anchors.sort((a, b) => a.editorTop - b.editorTop);

      const filtered = [{ editorTop: 0, previewTop: 0 }];
      let last = filtered[0];

      for (const a of anchors) {
        if (a.editorTop > last.editorTop && a.previewTop > last.previewTop) {
          filtered.push(a);
          last = a;
        }
      }

      // Explicitly map content ends to handle document boundaries
      try {
        const lastLine = view.lineBlockAt(docLength);
        const editorContentEnd = lastLine.bottom + editorTopOffset;
        const previewContent = preview.querySelector('.markdown-body');
        const previewContentEnd = previewContent 
          ? (previewContent.offsetTop + previewContent.offsetHeight) 
          : preview.scrollHeight;

        if (editorContentEnd > last.editorTop && previewContentEnd > last.previewTop) {
          filtered.push({ editorTop: editorContentEnd, previewTop: previewContentEnd });
          last = filtered[filtered.length - 1];
        }
      } catch (e) {}

      // Handle "scroll past end" virtual space by mapping absolute scroll limits
      const editorMax = view.scrollDOM.scrollHeight;
      const previewMax = preview.scrollHeight;
      if (editorMax > last.editorTop) {
        filtered.push({ editorTop: editorMax, previewTop: previewMax });
      }

      syncCache.current = filtered;
    });
  }, [previewRef, editorRef]);

  const performSync = useCallback((source) => {
    if (!active || !syncCache.current) return;

    if (source === 'editor') {
      if (isScrollingPreview.current) return;
      isScrollingEditor.current = true;
      
      const scrollTop = editorRef.current.scrollDOM.scrollTop;
      const anchors = syncCache.current;
      
      let low = 0, high = anchors.length - 2;
      let idx = 0;
      while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (anchors[mid].editorTop <= scrollTop) {
          idx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const p1 = anchors[idx], p2 = anchors[idx + 1];
      const span = p2.editorTop - p1.editorTop;
      const ratio = span > 0 ? Math.max(0, Math.min(1, (scrollTop - p1.editorTop) / span)) : 0;
      
      previewRef.current.scrollTo({
        top: lerp(p1.previewTop, p2.previewTop, ratio),
        behavior: 'auto'
      });
    } else {
      if (isScrollingEditor.current) return;
      isScrollingPreview.current = true;
      
      const scrollTop = previewRef.current.scrollTop;
      const anchors = syncCache.current;
      
      let low = 0, high = anchors.length - 2;
      let idx = 0;
      while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (anchors[mid].previewTop <= scrollTop) {
          idx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const p1 = anchors[idx], p2 = anchors[idx + 1];
      const span = p2.previewTop - p1.previewTop;
      const ratio = span > 0 ? Math.max(0, Math.min(1, (scrollTop - p1.previewTop) / span)) : 0;
      
      editorRef.current.scrollDOM.scrollTo({
        top: lerp(p1.editorTop, p2.editorTop, ratio),
        behavior: 'auto'
      });
    }

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrollingEditor.current = false;
      isScrollingPreview.current = false;
    }, 100);
  }, [active, editorRef, previewRef]);

  useEffect(() => {
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!active || !editor || !preview) return;

    updateSyncCache();

    const onEditorScroll = () => performSync('editor');
    const onPreviewScroll = () => performSync('preview');

    editor.scrollDOM.addEventListener('scroll', onEditorScroll, { passive: true });
    preview.addEventListener('scroll', onPreviewScroll, { passive: true });

    const observer = new ResizeObserver(updateSyncCache);
    observer.observe(preview);
    const content = preview.querySelector('.markdown-body');
    if (content) observer.observe(content);

    const loadHandler = (e) => {
      if (e.target.tagName === 'IMG') updateSyncCache();
    };
    preview.addEventListener('load', loadHandler, { capture: true });

    return () => {
      editor.scrollDOM.removeEventListener('scroll', onEditorScroll);
      preview.removeEventListener('scroll', onPreviewScroll);
      observer.disconnect();
      preview.removeEventListener('load', loadHandler, { capture: true });
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
    };
  }, [active, editorRef.current, previewRef.current, updateSyncCache, performSync, parsedHtml]);
}
