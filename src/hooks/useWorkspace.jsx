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

  const createLocalFile = useCallback(async (fileName, currentPath = '', initialContent = '') => {
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const existingFile = localWorkspaceFiles.find(f => f.path === fullPath);
    if (existingFile) {
      showToast(`File '${fileName}' already exists in this folder.`, 'error');
      return null;
    }
    const newFile = { 
      name: fileName, 
      path: fullPath, 
      type: 'file', 
      isLocal: true,
      content: initialContent 
    };
    
    // Save content to IndexedDB
    const storagePath = `local/${fullPath}`;
    await Promise.all([
      storage.saveOriginal(storagePath, initialContent),
      storage.saveDraft(storagePath, initialContent)
    ]);

    setLocalWorkspaceFiles(prev => [...prev, newFile]);
    showToast(`Created ${fileName}`);
    return newFile;
  }, [localWorkspaceFiles, showToast]);

  const createLocalFolder = useCallback((folderName, currentPath = '') => {
    if (!folderName) return null;
    const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    const existingFolder = localWorkspaceFiles.find(f => f.path === fullPath);
    if (existingFolder) {
      showToast(`Folder '${folderName}' already exists.`, 'error');
      return null;
    }
    const newFolder = { 
      name: folderName, 
      path: fullPath, 
      type: 'dir', 
      isLocal: true,
      content: '' 
    };
    
    setLocalWorkspaceFiles(prev => [...prev, newFolder]);
    showToast(`Created folder ${folderName}`);
    return newFolder;
  }, [localWorkspaceFiles, showToast]);

  const renameLocalFile = useCallback(async (fileToRename, newName) => {
    const pathParts = fileToRename.path.split('/');
    pathParts.pop();
    const basePath = pathParts.join('/');
    const newPath = basePath ? `${basePath}/${newName}` : newName;

    const existingFile = localWorkspaceFiles.find(f => f.path !== fileToRename.path && f.path === newPath);
    if (existingFile) {
      showToast(`A file or folder with name '${newName}' already exists.`, 'error');
      return false;
    }
    
    if (fileToRename.type === 'dir') {
      const oldPrefix = `${fileToRename.path}/`;
      const newPrefix = `${newPath}/`;
      
      const filesToUpdate = localWorkspaceFiles.filter(f => f.path.startsWith(oldPrefix) || f.path === fileToRename.path);
      
      for (const f of filesToUpdate) {
        if (f.type !== 'dir') {
          const oldStoragePath = `local/${f.path}`;
          const updatedPath = f.path === fileToRename.path ? newPath : f.path.replace(oldPrefix, newPrefix);
          const newStoragePath = `local/${updatedPath}`;
          await storage.renameFile(oldStoragePath, newStoragePath);
        }
      }

      setLocalWorkspaceFiles(prev => prev.map(f => {
        if (f.path === fileToRename.path) {
          return { ...f, name: newName, path: newPath };
        }
        if (f.path.startsWith(oldPrefix)) {
          const updatedPath = f.path.replace(oldPrefix, newPrefix);
          return { ...f, path: updatedPath };
        }
        return f;
      }));
    } else {
      const oldStoragePath = `local/${fileToRename.path}`;
      const newStoragePath = `local/${newPath}`;
      await storage.renameFile(oldStoragePath, newStoragePath);

      setLocalWorkspaceFiles(prev => prev.map(f => 
        f.path === fileToRename.path ? { ...f, name: newName, path: newPath } : f
      ));
    }

    showToast(`Renamed to ${newName}`);
    return true;
  }, [localWorkspaceFiles, showToast]);

  const deleteLocalFile = useCallback(async (fileToDelete) => {
    if (fileToDelete.type === 'dir') {
      const prefix = `${fileToDelete.path}/`;
      const filesToDelete = localWorkspaceFiles.filter(f => f.path.startsWith(prefix) || f.path === fileToDelete.path);
      
      for (const f of filesToDelete) {
        if (f.type !== 'dir') {
          const storagePath = `local/${f.path}`;
          await storage.deleteFile(storagePath);
        }
      }

      setLocalWorkspaceFiles(prev => prev.filter(f => !f.path.startsWith(prefix) && f.path !== fileToDelete.path));
    } else {
      const storagePath = `local/${fileToDelete.path}`;
      await storage.deleteFile(storagePath);

      setLocalWorkspaceFiles(prev => prev.filter(f => f.path !== fileToDelete.path));
    }
    showToast(`Deleted ${fileToDelete.name}`);
  }, [localWorkspaceFiles, showToast]);

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
    createLocalFolder,
    renameLocalFile,
    deleteLocalFile,
    updateLocalFileContent
  };
}
