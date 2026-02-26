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
  const lastUpdate = useRef(0);
  const rafId = useRef(null);
  
  // Cache for anchor points mapped between scroller coordinate systems
  const syncCache = useRef(null);

  const updateSyncCache = useCallback((force = false) => {
    if (!previewRef.current || !editorRef.current) return;
    
    const now = Date.now();
    // Throttle updates: 16ms if forced (60fps), 100ms otherwise
    const limit = force ? 16 : 100;
    
    if (!force && now - lastUpdate.current < limit) {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      updateTimeout.current = setTimeout(() => updateSyncCache(force), limit);
      return;
    }

    // Skip updates during active scrolling to prevent layout thrashing,
    // UNLESS it's a forced update (e.g. from a layout shift or CM measurement)
    if (!force && (isScrollingEditor.current || isScrollingPreview.current)) {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      updateTimeout.current = setTimeout(() => updateSyncCache(), 200);
      return;
    }

    lastUpdate.current = now;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    
    rafId.current = requestAnimationFrame(() => {
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

      anchors.sort((a, b) => a.editorTop - b.editorTop);

      const filtered = [{ editorTop: 0, previewTop: 0 }];
      let last = filtered[0];

      for (const a of anchors) {
        if (a.editorTop > last.editorTop && a.previewTop > last.previewTop) {
          filtered.push(a);
          last = a;
        }
      }

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

      const editorMax = view.scrollDOM.scrollHeight;
      const previewMax = preview.scrollHeight;
      if (editorMax > last.editorTop) {
        filtered.push({ editorTop: editorMax, previewTop: previewMax });
      }

      syncCache.current = filtered;
      rafId.current = null;
    });
  }, [previewRef, editorRef]);

  const performSync = useCallback((source) => {
    if (!active || !syncCache.current) return;

    const editorScroller = editorRef.current.scrollDOM;
    const previewScroller = previewRef.current;
    const TARGET_FOCUS_PCT = 0.2; // 20% from the top

    if (source === 'editor') {
      if (isScrollingPreview.current) return;
      isScrollingEditor.current = true;
      
      const scrollTop = editorScroller.scrollTop;
      const viewHeight = editorScroller.clientHeight;
      const targetViewHeight = previewScroller.clientHeight;
      const maxScroll = editorScroller.scrollHeight - viewHeight;

      // Force bottom lock
      if (scrollTop >= maxScroll - 2) {
        previewScroller.scrollTo({ top: previewScroller.scrollHeight - targetViewHeight, behavior: 'auto' });
      } else {
        // Smoothly transition from 0% focus (at top) to 20% focus (after scrolling half a viewport)
        const transitionProgress = Math.min(1, scrollTop / (viewHeight * 0.5));
        const effectiveFocusPct = transitionProgress * TARGET_FOCUS_PCT;
        
        const sourceFocus = scrollTop + (viewHeight * effectiveFocusPct);
        const anchors = syncCache.current;
        
        let low = 0, high = anchors.length - 2;
        let idx = 0;
        while (low <= high) {
          let mid = Math.floor((low + high) / 2);
          if (anchors[mid].editorTop <= sourceFocus) {
            idx = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        const p1 = anchors[idx], p2 = anchors[idx + 1];
        const span = p2.editorTop - p1.editorTop;
        const ratio = span > 0 ? Math.max(0, Math.min(1, (sourceFocus - p1.editorTop) / span)) : 0;
        
        const targetFocus = lerp(p1.previewTop, p2.previewTop, ratio);
        previewScroller.scrollTo({
          top: targetFocus - (targetViewHeight * effectiveFocusPct),
          behavior: 'auto'
        });
      }
    } else {
      if (isScrollingEditor.current) return;
      isScrollingPreview.current = true;
      
      const scrollTop = previewScroller.scrollTop;
      const viewHeight = previewScroller.clientHeight;
      const targetViewHeight = editorScroller.clientHeight;

      const transitionProgress = Math.min(1, scrollTop / (viewHeight * 0.5));
      const effectiveFocusPct = transitionProgress * TARGET_FOCUS_PCT;

      const sourceFocus = scrollTop + (viewHeight * effectiveFocusPct);
      const anchors = syncCache.current;
      
      let low = 0, high = anchors.length - 2;
      let idx = 0;
      while (low <= high) {
          let mid = Math.floor((low + high) / 2);
          if (anchors[mid].previewTop <= sourceFocus) {
            idx = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        const p1 = anchors[idx], p2 = anchors[idx + 1];
        const span = p2.previewTop - p1.previewTop;
        const ratio = span > 0 ? Math.max(0, Math.min(1, (sourceFocus - p1.previewTop) / span)) : 0;
        
        const targetFocus = lerp(p1.editorTop, p2.editorTop, ratio);
        editorScroller.scrollTo({
          top: targetFocus - (targetViewHeight * effectiveFocusPct),
          behavior: 'auto'
        });
    }

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrollingEditor.current = false;
      isScrollingPreview.current = false;
    }, 50); 
  }, [active, editorRef, previewRef]);

  useEffect(() => {
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!active || !editor || !preview) return;

    updateSyncCache(true);

    const onEditorScroll = () => performSync('editor');
    const onPreviewScroll = () => performSync('preview');

    editor.scrollDOM.addEventListener('scroll', onEditorScroll, { passive: true });
    preview.addEventListener('scroll', onPreviewScroll, { passive: true });

    const observer = new ResizeObserver(() => updateSyncCache(true));
    observer.observe(preview);
    observer.observe(editor.scrollDOM);
    const content = preview.querySelector('.markdown-body');
    if (content) observer.observe(content);

    const loadHandler = (e) => {
      if (e.target.tagName === 'IMG') updateSyncCache(true);
    };
    preview.addEventListener('load', loadHandler, { capture: true });

    return () => {
      editor.scrollDOM.removeEventListener('scroll', onEditorScroll);
      preview.removeEventListener('scroll', onPreviewScroll);
      observer.disconnect();
      preview.removeEventListener('load', loadHandler, { capture: true });
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [active, editorRef.current, previewRef.current, updateSyncCache, performSync, parsedHtml]);

  return updateSyncCache;
}


