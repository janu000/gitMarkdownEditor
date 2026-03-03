import { useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';

export default function useWorkspace(showToast) {
  const [localWorkspaceFiles, setLocalWorkspaceFiles] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('gme_local_workspace') || '[]');
    return stored.map(f => ({ ...f, isLocal: true }));
  });

  useEffect(() => {
    // Only store metadata, not content, to prevent quota exhaustion
    const metadataOnly = localWorkspaceFiles.map(f => {
      const { content, ...rest } = f;
      return rest;
    });
    localStorage.setItem('gme_local_workspace', JSON.stringify(metadataOnly));
  }, [localWorkspaceFiles]);

  const createLocalFile = useCallback(async (fileName, initialContent = '') => {
    const existingFile = localWorkspaceFiles.find(f => f.name === fileName);
    if (existingFile) {
      showToast(`File '${fileName}' already exists.`, 'error');
      return null;
    }
    const newFile = { 
      name: fileName, 
      path: fileName, 
      type: 'file', 
      isLocal: true,
      content: initialContent 
    };
    
    // Save content to IndexedDB
    const storagePath = `local/${fileName}`;
    await Promise.all([
      storage.saveOriginal(storagePath, initialContent),
      storage.saveDraft(storagePath, initialContent)
    ]);

    setLocalWorkspaceFiles(prev => [...prev, newFile]);
    showToast(`Created ${fileName}`);
    return newFile;
  }, [localWorkspaceFiles, showToast]);

  const renameLocalFile = useCallback(async (fileToRename, newName) => {
    const existingFile = localWorkspaceFiles.find(f => f.path !== fileToRename.path && f.name === newName);
    if (existingFile) {
      showToast(`File with name '${newName}' already exists.`, 'error');
      return false;
    }
    
    // Rename in IndexedDB
    const oldStoragePath = `local/${fileToRename.path}`;
    const newStoragePath = `local/${newName}`;
    await storage.renameFile(oldStoragePath, newStoragePath);

    setLocalWorkspaceFiles(prev => prev.map(f => 
      f.path === fileToRename.path ? { ...f, name: newName, path: newName } : f
    ));
    showToast(`Renamed to ${newName}`);
    return true;
  }, [localWorkspaceFiles, showToast]);

  const deleteLocalFile = useCallback(async (fileToDelete) => {
    // Delete from IndexedDB
    const storagePath = `local/${fileToDelete.path}`;
    await storage.deleteFile(storagePath);

    setLocalWorkspaceFiles(prev => prev.filter(f => f.path !== fileToDelete.path));
    showToast(`Deleted ${fileToDelete.name}`);
  }, [showToast]);

  const updateLocalFileContent = useCallback(async (path, content) => {
    // Save to IndexedDB (as original to clear modified state, draft is saved via auto-save)
    const storagePath = `local/${path}`;
    await storage.saveOriginal(storagePath, content);
    
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
