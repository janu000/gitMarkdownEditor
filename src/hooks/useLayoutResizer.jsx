import { useState, useEffect, useRef } from 'react';

export default function useLayoutResizer(containerRef) {
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [tempSplitRatio, setTempSplitRatio] = useState(0.5); // Fast state for dragging
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(150, Math.min(e.clientX, 600));
        setSidebarWidth(newWidth);
      }
      if (isResizingSplit) {
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const newRatio = Math.max(0.1, Math.min(relativeX / rect.width, 0.9));
          
          // Update the fast state immediately
          setTempSplitRatio(newRatio);
          
          // Debounce the heavy state update that triggers re-renders/CM6 resizing
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            setSplitRatio(newRatio);
          }, 16); // ~60fps target
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizingSplit) {
        setSplitRatio(tempSplitRatio);
      }
      setIsResizingSidebar(false);
      setIsResizingSplit(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizingSidebar || isResizingSplit) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingSplit, containerRef, tempSplitRatio]);

  return {
    sidebarWidth,
    setSidebarWidth,
    splitRatio,
    tempSplitRatio,
    setSplitRatio,
    isResizingSidebar,
    setIsResizingSidebar,
    isResizingSplit,
    setIsResizingSplit,
    isSidebarOpen,
    setIsSidebarOpen
  };
}
