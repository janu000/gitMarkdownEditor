import { useState, useEffect } from 'react';

export default function useLayoutResizer(editorRef) {
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(150, Math.min(e.clientX, 600));
        setSidebarWidth(newWidth);
      }
      if (isResizingSplit) {
        const mainArea = editorRef.current?.parentElement?.parentElement;
        if (mainArea) {
          const rect = mainArea.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const newRatio = Math.max(0.2, Math.min(relativeX / rect.width, 0.8));
          setSplitRatio(newRatio);
        }
      }
    };

    const handleMouseUp = () => {
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
  }, [isResizingSidebar, isResizingSplit, editorRef]);

  return {
    sidebarWidth,
    setSidebarWidth,
    splitRatio,
    setSplitRatio,
    isResizingSidebar,
    setIsResizingSidebar,
    isResizingSplit,
    setIsResizingSplit,
    isSidebarOpen,
    setIsSidebarOpen
  };
}
