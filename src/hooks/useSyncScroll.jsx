import { useEffect, useRef, useCallback } from 'react';

/**
 * Linear Interpolation helper
 */
const lerp = (a, b, t) => a + (b - a) * t;

const CANDIDATE_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, blockquote, pre, code, .code-block, [data-type="code_block"], div.katex-display, [data-type="math_block"], table tr, li, hr';

function normalizeSnippet(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase();
}

/**
 * High-precision bi-directional scroll synchronization.
 * Supports both CodeMirror 6 (Source Mode) and Milkdown/Crepe ProseMirror (Visual Mode)
 * paired with the Live Preview pane.
 */
export default function useSyncScroll(editorRef, richEditorRef, previewRef, editorMode, active, parsedHtml) {
  const isScrollingEditor = useRef(false);
  const isScrollingPreview = useRef(false);
  const scrollTimeout = useRef(null);
  const updateTimeout = useRef(null);
  const lastUpdate = useRef(0);
  const rafId = useRef(null);
  
  // Cache for anchor points mapped between scroller coordinate systems
  const syncCache = useRef(null);

  const getEditorScroller = useCallback(() => {
    if (editorMode === 'visual') {
      return (
        richEditorRef?.current?.getScrollElement?.() ||
        document.querySelector('#editor-container .rich-markdown-editor') ||
        document.querySelector('.rich-markdown-editor') ||
        null
      );
    }
    return (
      editorRef?.current?.scrollDOM ||
      document.querySelector('#editor-container .cm-scroller') ||
      document.querySelector('.cm-scroller') ||
      null
    );
  }, [editorMode, editorRef, richEditorRef]);

  const updateSyncCache = useCallback(function updateSyncCacheInternal(force = false) {
    const preview = previewRef.current;
    const editorScroller = getEditorScroller();
    if (!preview || !editorScroller) return;
    
    const now = Date.now();
    // Throttle updates: 16ms if forced (60fps), 100ms otherwise
    const limit = force ? 16 : 100;
    
    if (!force && now - lastUpdate.current < limit) {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      updateTimeout.current = setTimeout(() => updateSyncCacheInternal(force), limit);
      return;
    }

    // Skip updates during active scrolling to prevent layout thrashing,
    // UNLESS it's a forced update (e.g. from a layout shift or editor measurement)
    if (!force && (isScrollingEditor.current || isScrollingPreview.current)) {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      updateTimeout.current = setTimeout(() => updateSyncCacheInternal(), 200);
      return;
    }

    lastUpdate.current = now;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    
    rafId.current = requestAnimationFrame(() => {
      const previewEl = previewRef.current;
      const scroller = getEditorScroller();
      if (!previewEl || !scroller) return;

      const previewRect = previewEl.getBoundingClientRect();
      const editorScrollerRect = scroller.getBoundingClientRect();

      const anchors = [];

      if (editorMode === 'source' && editorRef.current) {
        const view = editorRef.current;
        const elements = Array.from(previewEl.querySelectorAll('[data-offset-start]'));
        if (elements.length > 0) {
          const editorTopOffset = view.contentDOM?.offsetTop || 0;
          const docLength = view.state?.doc?.length || 0;

          for (const el of elements) {
            const offset = Math.min(parseInt(el.getAttribute('data-offset-start'), 10), docLength);
            const rect = el.getBoundingClientRect();
            
            try {
              const line = view.lineBlockAt(offset);
              anchors.push({
                editorTop: line.top + editorTopOffset,
                previewTop: rect.top - previewRect.top + previewEl.scrollTop,
              });
            } catch {
              // Ignore lines that can't be measured
            }
          }

          try {
            const lastLine = view.lineBlockAt(docLength);
            const editorContentEnd = lastLine.bottom + editorTopOffset;
            const previewContent = previewEl.querySelector('.markdown-body');
            const previewContentEnd = previewContent 
              ? (previewContent.offsetTop + previewContent.offsetHeight) 
              : previewEl.scrollHeight;

            if (editorContentEnd > 0 && previewContentEnd > 0) {
              anchors.push({ editorTop: editorContentEnd, previewTop: previewContentEnd });
            }
          } catch {
            // Ignore parsing errors for the last line
          }
        }
      } else {
        // Visual Mode (Milkdown Crepe ProseMirror) -> High precision semantic signature alignment
        const visualDoc = scroller.querySelector('.ProseMirror') || scroller;
        const previewDoc = previewEl.querySelector('.markdown-body') || previewEl;

        if (visualDoc && previewDoc) {
          const pNodes = Array.from(previewDoc.querySelectorAll(CANDIDATE_SELECTOR));
          const vNodes = Array.from(visualDoc.querySelectorAll(CANDIDATE_SELECTOR));

          const pItems = [];
          for (const el of pNodes) {
            if (el.offsetHeight <= 0) continue;
            const tag = el.tagName.toLowerCase();
            const text = normalizeSnippet(el.innerText || el.textContent);
            if (!text && tag !== 'hr') continue;
            pItems.push({
              el,
              tag,
              snippet: text,
              isHeading: /^h[1-6]$/.test(tag),
              isCode: tag === 'pre' || tag === 'code' || el.classList.contains('code-block') || el.getAttribute('data-type') === 'code_block',
              isMath: el.classList.contains('katex-display') || el.getAttribute('data-type') === 'math_block',
              isList: tag === 'li',
              isRow: tag === 'tr',
            });
          }

          const vItems = [];
          for (const el of vNodes) {
            if (el.offsetHeight <= 0) continue;
            const tag = el.tagName.toLowerCase();
            const text = normalizeSnippet(el.innerText || el.textContent);
            if (!text && tag !== 'hr') continue;
            vItems.push({
              el,
              tag,
              snippet: text,
              isHeading: /^h[1-6]$/.test(tag),
              isCode: tag === 'pre' || tag === 'code' || el.classList.contains('code-block') || el.getAttribute('data-type') === 'code_block',
              isMath: el.classList.contains('katex-display') || el.getAttribute('data-type') === 'math_block',
              isList: tag === 'li',
              isRow: tag === 'tr',
            });
          }

          let vCursor = 0;
          for (const pItem of pItems) {
            let matchedIndex = -1;
            const windowLimit = Math.min(vItems.length, vCursor + 30);

            for (let j = vCursor; j < windowLimit; j++) {
              const vItem = vItems[j];

              // Check headings (strict tag and text match)
              if (pItem.isHeading && vItem.isHeading) {
                if (
                  pItem.tag === vItem.tag &&
                  (pItem.snippet === vItem.snippet ||
                    pItem.snippet.startsWith(vItem.snippet.slice(0, 15)) ||
                    vItem.snippet.startsWith(pItem.snippet.slice(0, 15)))
                ) {
                  matchedIndex = j;
                  break;
                }
              }
              // Check code blocks
              else if (pItem.isCode && vItem.isCode) {
                if (
                  pItem.snippet.length > 5 &&
                  vItem.snippet.length > 5 &&
                  (pItem.snippet.startsWith(vItem.snippet.slice(0, 15)) ||
                    vItem.snippet.startsWith(pItem.snippet.slice(0, 15)))
                ) {
                  matchedIndex = j;
                  break;
                }
              }
              // Check list items
              else if (pItem.isList && vItem.isList) {
                if (
                  pItem.snippet.length > 3 &&
                  vItem.snippet.length > 3 &&
                  (pItem.snippet === vItem.snippet ||
                    pItem.snippet.startsWith(vItem.snippet.slice(0, 15)) ||
                    vItem.snippet.startsWith(pItem.snippet.slice(0, 15)))
                ) {
                  matchedIndex = j;
                  break;
                }
              }
              // Check table rows
              else if (pItem.isRow && vItem.isRow) {
                if (
                  pItem.snippet.length > 2 &&
                  vItem.snippet.length > 2 &&
                  (pItem.snippet === vItem.snippet ||
                    pItem.snippet.startsWith(vItem.snippet.slice(0, 10)) ||
                    vItem.snippet.startsWith(pItem.snippet.slice(0, 10)))
                ) {
                  matchedIndex = j;
                  break;
                }
              }
              // Check math blocks
              else if (pItem.isMath && vItem.isMath) {
                matchedIndex = j;
                break;
              }
              // Check horizontal rules
              else if (pItem.tag === 'hr' && vItem.tag === 'hr') {
                matchedIndex = j;
                break;
              }
              // Check paragraphs / blockquotes
              else if (pItem.snippet.length >= 8 && vItem.snippet.length >= 8) {
                if (
                  pItem.snippet === vItem.snippet ||
                  pItem.snippet.startsWith(vItem.snippet.slice(0, 20)) ||
                  vItem.snippet.startsWith(pItem.snippet.slice(0, 20))
                ) {
                  matchedIndex = j;
                  break;
                }
              }
            }

            if (matchedIndex !== -1) {
              const vEl = vItems[matchedIndex].el;
              const pEl = pItem.el;
              const vRect = vEl.getBoundingClientRect();
              const pRect = pEl.getBoundingClientRect();

              const editorTop = vRect.top - editorScrollerRect.top + scroller.scrollTop;
              const previewTop = pRect.top - previewRect.top + previewEl.scrollTop;

              anchors.push({ editorTop, previewTop });
              vCursor = matchedIndex + 1;
            }
          }
        }
      }

      // Sort anchors strictly by editorTop
      anchors.sort((a, b) => a.editorTop - b.editorTop);

      const filtered = [{ editorTop: 0, previewTop: 0 }];
      let last = filtered[0];

      for (const a of anchors) {
        if (a.editorTop > last.editorTop + 1 && a.previewTop > last.previewTop + 1) {
          filtered.push(a);
          last = a;
        }
      }

      const editorMax = scroller.scrollHeight;
      const previewMax = previewEl.scrollHeight;
      if (editorMax > last.editorTop && previewMax > last.previewTop) {
        filtered.push({ editorTop: editorMax, previewTop: previewMax });
      }

      syncCache.current = filtered;
      rafId.current = null;
    });
  }, [editorMode, editorRef, getEditorScroller, previewRef]);

  const performSync = useCallback((source) => {
    if (!active || !syncCache.current) return;

    const editorScroller = getEditorScroller();
    const previewScroller = previewRef.current;
    if (!editorScroller || !previewScroller) return;

    const TARGET_FOCUS_PCT = 0.2; // 20% from the top

    if (source === 'editor') {
      if (isScrollingPreview.current) return;
      isScrollingEditor.current = true;
      
      const scrollTop = editorScroller.scrollTop;
      const viewHeight = editorScroller.clientHeight;
      const targetViewHeight = previewScroller.clientHeight;
      const maxScroll = editorScroller.scrollHeight - viewHeight;

      // Force bottom lock
      if (maxScroll > 0 && scrollTop >= maxScroll - 3) {
        previewScroller.scrollTo({ top: previewScroller.scrollHeight - targetViewHeight, behavior: 'auto' });
      } else {
        // Smoothly transition from 0% focus (at top) to 20% focus (after scrolling half a viewport)
        const transitionProgress = Math.min(1, scrollTop / (Math.max(1, viewHeight) * 0.5));
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

        const p1 = anchors[idx], p2 = anchors[idx + 1] || anchors[idx];
        const span = p2.editorTop - p1.editorTop;
        const ratio = span > 0 ? Math.max(0, Math.min(1, (sourceFocus - p1.editorTop) / span)) : 0;
        
        const targetFocus = lerp(p1.previewTop, p2.previewTop, ratio);
        previewScroller.scrollTo({
          top: Math.max(0, targetFocus - (targetViewHeight * effectiveFocusPct)),
          behavior: 'auto'
        });
      }
    } else {
      if (isScrollingEditor.current) return;
      isScrollingPreview.current = true;
      
      const scrollTop = previewScroller.scrollTop;
      const viewHeight = previewScroller.clientHeight;
      const targetViewHeight = editorScroller.clientHeight;
      const maxScroll = previewScroller.scrollHeight - viewHeight;

      // Force bottom lock
      if (maxScroll > 0 && scrollTop >= maxScroll - 3) {
        editorScroller.scrollTo({ top: editorScroller.scrollHeight - targetViewHeight, behavior: 'auto' });
      } else {
        const transitionProgress = Math.min(1, scrollTop / (Math.max(1, viewHeight) * 0.5));
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

        const p1 = anchors[idx], p2 = anchors[idx + 1] || anchors[idx];
        const span = p2.previewTop - p1.previewTop;
        const ratio = span > 0 ? Math.max(0, Math.min(1, (sourceFocus - p1.previewTop) / span)) : 0;
        
        const targetFocus = lerp(p1.editorTop, p2.editorTop, ratio);
        editorScroller.scrollTo({
          top: Math.max(0, targetFocus - (targetViewHeight * effectiveFocusPct)),
          behavior: 'auto'
        });
      }
    }

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrollingEditor.current = false;
      isScrollingPreview.current = false;
    }, 50); 
  }, [active, getEditorScroller, previewRef]);

  useEffect(() => {
    if (!active) return undefined;

    let cleanupCurrent = null;
    let retryTimer = null;

    const bindScrollers = () => {
      const preview = previewRef.current;
      const editorScroller = getEditorScroller();

      if (!preview || !editorScroller) {
        retryTimer = setTimeout(bindScrollers, 50);
        return;
      }

      updateSyncCache(true);

      const onEditorScroll = () => performSync('editor');
      const onPreviewScroll = () => performSync('preview');

      editorScroller.addEventListener('scroll', onEditorScroll, { passive: true });
      preview.addEventListener('scroll', onPreviewScroll, { passive: true });

      const observer = new ResizeObserver(() => updateSyncCache(true));
      observer.observe(preview);
      observer.observe(editorScroller);

      const previewContent = preview.querySelector('.markdown-body');
      if (previewContent) observer.observe(previewContent);

      const visualDoc = editorScroller.querySelector('.ProseMirror');
      if (visualDoc) observer.observe(visualDoc);

      const loadHandler = (e) => {
        if (e.target.tagName === 'IMG') updateSyncCache(true);
      };
      preview.addEventListener('load', loadHandler, { capture: true });
      editorScroller.addEventListener('load', loadHandler, { capture: true });

      setTimeout(() => updateSyncCache(true), 100);

      cleanupCurrent = () => {
        editorScroller.removeEventListener('scroll', onEditorScroll);
        preview.removeEventListener('scroll', onPreviewScroll);
        observer.disconnect();
        preview.removeEventListener('load', loadHandler, { capture: true });
        editorScroller.removeEventListener('load', loadHandler, { capture: true });
      };
    };

    bindScrollers();

    // Listen for DOM changes in the editor container to immediately re-bind on mode switch
    const editorContainer = document.getElementById('editor-container') || document.getElementById('root');
    let mutationObs = null;
    if (editorContainer) {
      mutationObs = new MutationObserver(() => {
        if (cleanupCurrent) cleanupCurrent();
        bindScrollers();
      });
      mutationObs.observe(editorContainer, { childList: true, subtree: true });
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupCurrent) cleanupCurrent();
      if (mutationObs) mutationObs.disconnect();
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [active, editorMode, getEditorScroller, previewRef, updateSyncCache, performSync, parsedHtml]);

  return updateSyncCache;
}
