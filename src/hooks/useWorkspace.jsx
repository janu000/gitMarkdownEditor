import { useState, useEffect, useCallback } from 'react';

export default function useWorkspace(showToast) {
  const [localWorkspaceFiles, setLocalWorkspaceFiles] = useState(() => 
    JSON.parse(localStorage.getItem('gme_local_workspace') || '[]')
  );

  useEffect(() => {
    localStorage.setItem('gme_local_workspace', JSON.stringify(localWorkspaceFiles));
  }, [localWorkspaceFiles]);

  const createLocalFile = useCallback((fileName, initialContent = '') => {
    const existingFile = localWorkspaceFiles.find(f => f.name === fileName);
    if (existingFile) {
      showToast(`File '${fileName}' already exists.`, 'error');
      return null;
    }
    const newFile = { 
      name: fileName, 
      path: fileName, 
      type: 'file', 
      content: initialContent 
    };
    setLocalWorkspaceFiles(prev => [...prev, newFile]);
    showToast(`Created ${fileName}`);
    return newFile;
  }, [localWorkspaceFiles, showToast]);

  const renameLocalFile = useCallback((fileToRename, newName) => {
    const existingFile = localWorkspaceFiles.find(f => f.path !== fileToRename.path && f.name === newName);
    if (existingFile) {
      showToast(`File with name '${newName}' already exists.`, 'error');
      return false;
    }
    setLocalWorkspaceFiles(prev => prev.map(f => 
      f.path === fileToRename.path ? { ...f, name: newName, path: newName } : f
    ));
    showToast(`Renamed to ${newName}`);
    return true;
  }, [localWorkspaceFiles, showToast]);

  const deleteLocalFile = useCallback((fileToDelete) => {
    setLocalWorkspaceFiles(prev => prev.filter(f => f.path !== fileToDelete.path));
    showToast(`Deleted ${fileToDelete.name}`);
  }, [showToast]);

  const updateLocalFileContent = useCallback((path, content) => {
    setLocalWorkspaceFiles(prev => prev.map(f => 
      f.path === path ? { ...f, content } : f
    ));
  }, []);

  return {
    localWorkspaceFiles,
    setLocalWorkspaceFiles,
    createLocalFile,
    renameLocalFile,
    deleteLocalFile,
    updateLocalFileContent
  };
}
