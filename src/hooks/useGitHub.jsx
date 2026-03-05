import { useState, useEffect, useCallback, useRef } from 'react';
import { utf8_to_b64, b64_to_utf8 } from '../utils/encoding';
import { storage } from '../utils/storage';

export default function useGitHub(showToast, setLoadingState, {
  content, setContent, defaultContent,
  activeFile, setActiveFile,
  activeFileRef,
  pendingOps, setPendingOps,
  pathStack, setPathStack,
  updateTOC,
  setShowAuthModal
}) {
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('gme_gh_token') || '');
  const [ghUser, setGhUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [currentRepo, setCurrentRepo] = useState(() => localStorage.getItem('gme_current_repo') || null);
  const currentRepoRef = useRef(null);
  const [repoContents, setRepoContents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(() => localStorage.getItem('gme_current_branch') || '');
  const currentBranchRef = useRef('');
  const [manualRepo, setManualRepo] = useState('');
  const [hiddenRepos, setHiddenRepos] = useState(() => JSON.parse(localStorage.getItem('gme_hidden_repos') || '[]'));

  // Sync refs for async callbacks
  useEffect(() => { 
    currentRepoRef.current = currentRepo;
    if (currentRepo) localStorage.setItem('gme_current_repo', currentRepo);
    else localStorage.removeItem('gme_current_repo');
  }, [currentRepo]);

  useEffect(() => { 
    currentBranchRef.current = currentBranch;
    if (currentBranch) localStorage.setItem('gme_current_branch', currentBranch);
    else localStorage.removeItem('gme_current_branch');
  }, [currentBranch]);

  useEffect(() => { localStorage.setItem('gme_hidden_repos', JSON.stringify(hiddenRepos)); }, [hiddenRepos]);

  const apiRequest = useCallback(async (endpoint, method = 'GET', body = null, customToken = null, useCache = false) => {
    const tokenToUse = customToken || ghToken;
    let url = `https://api.github.com${endpoint}`;
    
    if (method === 'GET' && !useCache) {
      url += `${url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${tokenToUse}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      cache: useCache ? 'default' : 'no-store',
      body: body ? JSON.stringify(body) : null
    });
    if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
    return response.json();
  }, [ghToken]);

  const fetchRepos = useCallback(async (tokenOverride = null) => {
    setLoadingState('fetching');
    try {
      const data = await apiRequest('/user/repos?affiliation=owner,collaborator&sort=updated&per_page=100', 'GET', null, tokenOverride);
      setRepos(Array.isArray(data) ? data.filter(repo => repo?.permissions?.push === true) : []);
    } catch (_error) {
      showToast('Failed to fetch repositories', 'error');
    }
    setLoadingState('');
  }, [apiRequest, showToast, setLoadingState]);

  const verifyGitHubToken = useCallback(async (token, silent = false) => {
    setLoadingState('verifying');
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('gme_gh_token');
          setGhToken('');
          if (!silent) showToast('Invalid GitHub Token', 'error');
        } else {
          if (!silent) showToast('GitHub API Error', 'error');
        }
        setLoadingState('');
        return;
      }

      const user = await res.json();
      setGhToken(token);
      localStorage.setItem('gme_gh_token', token);
      setGhUser(user);
      fetchRepos(token);
      if (setShowAuthModal) setShowAuthModal(false);
      if (!silent) showToast('Connected to GitHub');
      return user;
    } catch (_error) {
      if (!silent) showToast('Connection Error', 'error');
    } finally {
      setLoadingState('');
    }
  }, [fetchRepos, showToast, setLoadingState]);

  const getStoragePath = useCallback((path, repo = currentRepoRef.current, branch = currentBranchRef.current) => {
    if (!repo) return `local/${path}`;
    return `${repo}/${branch}/${path}`;
  }, []);

  const fetchRepoContents = useCallback(async (repoFullName, path = '', branch = null, forceRefreshBranches = false, silent = false) => {
    if (!silent) setLoadingState('fetching');
    try {
      let targetBranch = branch || currentBranch;
      
      if (repoFullName !== currentRepo || !targetBranch || forceRefreshBranches || branches.length === 0) {
        const [repoInfo, branchesData] = await Promise.all([
          apiRequest(`/repos/${repoFullName}`),
          apiRequest(`/repos/${repoFullName}/branches`)
        ]);
        
        setBranches(branchesData);
        if (!branch && !currentBranch) {
          targetBranch = repoInfo.default_branch;
          setCurrentBranch(targetBranch);
        }
      }

      const data = await apiRequest(`/repos/${repoFullName}/contents/${path}?ref=${targetBranch}`);
      const newItems = Array.isArray(data) ? data : [data];
      
      setRepoContents(prev => {
        if (path === '' && !branch && repoFullName !== currentRepo) {
           return newItems.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
          });
        }
        
        // Merge: remove old items for this path's immediate children and add new ones
        const otherItems = prev.filter(f => {
          if (path === '') return f.path.includes('/'); // Keep subfolder items, remove root items
          const isChild = f.path.startsWith(path + '/') && f.path.slice(path.length + 1).indexOf('/') === -1;
          return !isChild;
        });
        
        return [...otherItems, ...newItems].sort((a, b) => {
          if (a.type === b.type) return a.path.localeCompare(b.path);
          return a.type === 'dir' ? -1 : 1;
        });
      });
      
      setCurrentRepo(repoFullName);
    } catch (_error) {
      if (!silent) showToast('Failed to fetch folder contents', 'error');
    }
    if (!silent) setLoadingState('');
  }, [apiRequest, currentBranch, currentRepo, setLoadingState, showToast, branches.length]);

  const loadFile = useCallback(async (file, forceFresh = false, silent = false) => {
    const targetRepo = file.repo || currentRepoRef.current;
    const targetBranch = file.branch || currentBranchRef.current;
    
    if (file.type === 'dir') {
      // In VS Code style, clicking a folder toggles it. 
      // This will be handled in Sidebar/App via expandedPaths.
      // We just need to ensure contents are fetched.
      if (targetRepo) fetchRepoContents(targetRepo, file.path, targetBranch, false, silent);
      return;
    }
    
    if (!file.name.match(/\.(md|txt|mdx)$/i)) {
      showToast('Only Markdown/Text files are supported', 'error');
      return;
    }

    if (!targetRepo) {
      console.log('[loadFile] No target repo, setting content from IndexedDB for local file');
      setLoadingState('fetching');
      try {
        const fullPath = `local/${file.path}`;
        const localDraft = await storage.getDraft(fullPath);
        const contentToLoad = localDraft !== null ? localDraft : (file.content || '');
        setContent(contentToLoad);
        setActiveFile(file);
        showToast(`Loaded ${file.name}`);
      } catch (err) {
        console.error('[loadFile] Error loading local file:', err);
        showToast('Failed to load local file', 'error');
      } finally {
        setLoadingState('');
      }
      return;
    }

    const pendingOp = pendingOps[file.path];
    if (pendingOp && pendingOp.action === 'add') {
      if (pendingOp.content !== undefined) {
        setContent(pendingOp.content);
        setActiveFile({ ...file, branch: targetBranch });
        return;
      } else {
        showToast('File is syncing, please wait...', 'info');
        return;
      }
    }

    setLoadingState('fetching');
    try {
      // 1. Check for local draft first (unless forceFresh is true)
      const fullPath = getStoragePath(file.path, targetRepo, targetBranch);
      console.log('[loadFile] Evaluating fullPath:', fullPath);
      
      if (!forceFresh) {
        const localDraft = await storage.getDraft(fullPath);
        if (localDraft !== null) {
          console.log('[loadFile] Found local draft for:', fullPath);
          setContent(localDraft);
          setActiveFile({ path: file.path, sha: file.sha, name: file.name, type: 'file', repo: targetRepo, branch: targetBranch });
          setLoadingState('');
          showToast(`Loaded draft for ${file.name}`);
          return;
        }
      }

      console.log('[loadFile] Fetching from GitHub API for:', fullPath);
      // 2. No draft found or force sync requested: Fetch from GitHub
      const data = await apiRequest(`/repos/${targetRepo}/contents/${file.path}?ref=${targetBranch}`, 'GET', null, null, !forceFresh);
      const decodedContent = b64_to_utf8(data.content);
      
      // 3. Save to IndexedDB (Original & Draft)
      await Promise.all([
        storage.saveOriginal(fullPath, decodedContent),
        storage.saveDraft(fullPath, decodedContent)
      ]);

      setContent(decodedContent);
      setActiveFile({ path: file.path, sha: data.sha, name: file.name, type: 'file', repo: targetRepo, branch: targetBranch });
      showToast(forceFresh ? `Synced with GitHub` : `Loaded ${file.name}`);
    } catch (_error) {
      console.error('[loadFile] Error loading file:', _error);
      showToast('Failed to load file', 'error');
    }
    setLoadingState('');
  }, [apiRequest, fetchRepoContents, pendingOps, setActiveFile, setContent, setLoadingState, setPathStack, showToast, getStoragePath]);

  const saveToGitHub = useCallback(async () => {
    const currentActiveFile = activeFileRef.current;
    const repoContext = currentRepoRef.current; 
    const branchContext = currentActiveFile?.branch || currentBranchRef.current;

    if (!currentActiveFile || !repoContext) return;
    
    const performPush = async (sha, isForce = false) => {
      const body = {
        message: `${isForce ? 'Force update' : 'Update'} ${currentActiveFile.name} via Git Markdown Editor`,
        content: utf8_to_b64(content),
        sha: sha,
        branch: branchContext
      };
      return await apiRequest(`/repos/${repoContext}/contents/${currentActiveFile.path}`, 'PUT', body);
    };

    setLoadingState('saving');
    // Optimistic Update
    setPendingOps(prev => ({ 
      ...prev, 
      [currentActiveFile.path]: { action: 'add', file: { ...currentActiveFile, status: 'pending' }, content: content } 
    }));
    showToast(`Committing ${currentActiveFile.name}...`);

    try {
      let data;
      try {
        data = await performPush(currentActiveFile.sha);
      } catch (err) {
        if (err.message.includes('409')) {
          const force = window.confirm("Conflict Detected: The version on GitHub has changed.\n\nWould you like to FORCE PUSH? (This will overwrite remote changes)");
          if (force) {
            showToast('Fetching latest SHA for force push...', 'info');
            const latest = await apiRequest(`/repos/${repoContext}/contents/${currentActiveFile.path}?ref=${branchContext}`, 'GET', null, null, false);
            data = await performPush(latest.sha, true);
            showToast('Force push successful!');
          } else {
            throw err; // Rethrow to be caught by outer catch
          }
        } else {
          throw err;
        }
      }
      
      // Update original in storage after successful commit
      const fullPath = getStoragePath(currentActiveFile.path, repoContext, branchContext);
      await storage.saveOriginal(fullPath, content);

      // CRITICAL: Update state with the NEW SHA returned by GitHub
      const newSha = data.content.sha;
      const updatedFile = { ...currentActiveFile, sha: newSha, branch: branchContext };
      
      // Sync the new SHA back to the master list so switching files doesn't revert to stale metadata
      setRepoContents(prev => prev.map(f => 
        f.path === currentActiveFile.path ? { ...f, sha: newSha } : f
      ));

      setActiveFile(updatedFile);
      showToast('Successfully committed to GitHub!');
    } catch (err) {
      showToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setPendingOps(prev => { const newState = { ...prev }; delete newState[currentActiveFile.path]; return newState; });
      setLoadingState('');
    }
  }, [apiRequest, content, setActiveFile, setPendingOps, setLoadingState, showToast, activeFileRef, getStoragePath]);

  const renameFile = useCallback(async (fileToRename) => {
    const branchContext = fileToRename.branch || currentBranchRef.current;
    if (!currentRepoRef.current) return;

    if (fileToRename.type === 'dir') {
      try {
        setLoadingState('fetching');
        const contents = await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToRename.path}?ref=${branchContext}`);
        
        const isBasicallyEmpty = Array.isArray(contents) && (contents.length === 0 || (contents.length === 1 && contents[0].name === '.gitkeep'));
        
        if (!isBasicallyEmpty) {
          setLoadingState('');
          showToast('Folder is not empty. Cannot rename via UI.', 'error');
          return;
        }

        const newName = prompt(`Rename folder ${fileToRename.name} to:`, fileToRename.name);
        if (!newName || newName === fileToRename.name) {
          setLoadingState('');
          return;
        }

        setLoadingState('saving');
        const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
        const newPath = currentPath ? `${currentPath}/${newName}` : newName;

        // Create new .gitkeep
        await apiRequest(`/repos/${currentRepoRef.current}/contents/${newPath}/.gitkeep`, 'PUT', {
          message: `Rename folder ${fileToRename.name} to ${newName} via Git Markdown Editor`,
          content: utf8_to_b64(''),
          branch: branchContext
        });

        // Delete old .gitkeep if it exists
        const gitkeepFile = Array.isArray(contents) ? contents.find(f => f.name === '.gitkeep') : null;
        if (gitkeepFile) {
          await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToRename.path}/.gitkeep`, 'DELETE', {
            message: `Cleanup old .gitkeep for ${fileToRename.name}`,
            sha: gitkeepFile.sha,
            branch: branchContext
          });
        }

        const newDirEntry = { name: newName, path: newPath, type: 'dir' };
        setRepoContents(prev => {
          const filtered = prev.filter(f => f.path !== fileToRename.path);
          return [...filtered, newDirEntry].sort((a, b) => {
             if (a.type === b.type) return a.name.localeCompare(b.name);
             return a.type === 'dir' ? -1 : 1;
          });
        });
        showToast(`Renamed to ${newName}`);
        fetchRepoContents(currentRepoRef.current, currentPath, branchContext);

      } catch (error) {
        showToast('Failed to check or rename folder', 'error');
      } finally {
        setLoadingState('');
      }
      return;
    }

    const newName = prompt(`Rename ${fileToRename.name} to:`, fileToRename.name);
    if (!newName || newName === fileToRename.name) return;

    const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
    const newPath = currentPath ? `${currentPath}/${newName}` : newName;

    // Git Mode Rename Optimistic
    const newFile = { ...fileToRename, name: newName, path: newPath, branch: branchContext };
    setPendingOps(prev => ({
      ...prev,
      [fileToRename.path]: { action: 'delete' },
      [newPath]: { action: 'add', file: newFile }
    }));
    if (activeFileRef.current?.path === fileToRename.path) setActiveFile(newFile);
    showToast(`Renaming to ${newName}...`);

    try {
      const sourceData = await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToRename.path}?ref=${branchContext}`);
      const createBody = {
        message: `Rename ${fileToRename.name} to ${newName} via Git Markdown Editor`,
        content: sourceData.content.replace(/\n/g, ''),
        branch: branchContext
      };
      const createRes = await apiRequest(`/repos/${currentRepoRef.current}/contents/${newPath}`, 'PUT', createBody);

      const deleteBody = { 
        message: `Rename ${fileToRename.name} to ${newName} (cleanup)`, 
        sha: sourceData.sha, 
        branch: branchContext
      };
      await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToRename.path}`, 'DELETE', deleteBody);

      // Keep cache in sync
      const oldFullPath = getStoragePath(fileToRename.path, currentRepoRef.current, branchContext);
      const newFullPath = getStoragePath(newPath, currentRepoRef.current, branchContext);
      await storage.renameFile(oldFullPath, newFullPath);

      setRepoContents(prev => {
        const filtered = prev.filter(f => f.path !== fileToRename.path);
        return [...filtered, { name: newName, path: newPath, type: 'file', sha: createRes.content.sha }].sort((a, b) => {
           if (a.type === b.type) return a.name.localeCompare(b.name);
           return a.type === 'dir' ? -1 : 1;
        });
      });
      
      setPendingOps(prev => {
        const newState = { ...prev };
        delete newState[fileToRename.path];
        delete newState[newPath];
        return newState;
      });
      showToast(`Renamed ${newName}`);
      
      const currentDirPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
      fetchRepoContents(currentRepoRef.current, currentDirPath, branchContext);
      if (activeFileRef.current && activeFileRef.current.path === newPath) setActiveFile(prev => ({ ...prev, sha: createRes.content.sha }));
    } catch (_error) {
      showToast(`Failed to rename: ${_error.message || 'Unknown error'}`, 'error');
      setPendingOps(prev => {
        const newState = { ...prev };
        delete newState[fileToRename.path];
        delete newState[newPath];
        return newState;
      });
      if (activeFileRef.current?.path === newPath) setActiveFile(fileToRename);
    }
  }, [apiRequest, fetchRepoContents, pathStack, setActiveFile, setPendingOps, showToast, activeFileRef, getStoragePath]);

  const deleteFile = useCallback(async (fileToDelete) => {
    if (!currentRepoRef.current) return;
    const branchContext = fileToDelete.branch || currentBranchRef.current;

    if (fileToDelete.type === 'dir') {
      try {
        setLoadingState('fetching');
        const contents = await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToDelete.path}?ref=${branchContext}`);
        
        const isBasicallyEmpty = Array.isArray(contents) && (contents.length === 0 || (contents.length === 1 && contents[0].name === '.gitkeep'));
        
        if (!isBasicallyEmpty) {
          setLoadingState('');
          showToast('Folder is not empty. Cannot delete via UI.', 'error');
          return;
        }

        if (!window.confirm(`Delete folder ${fileToDelete.name}?`)) {
          setLoadingState('');
          return;
        }

        setLoadingState('saving');
        showToast(`Deleting folder ${fileToDelete.name}...`);

        const gitkeepFile = Array.isArray(contents) ? contents.find(f => f.name === '.gitkeep') : null;
        if (gitkeepFile) {
          await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToDelete.path}/.gitkeep`, 'DELETE', {
            message: `Delete folder ${fileToDelete.name} via Git Markdown Editor`,
            sha: gitkeepFile.sha,
            branch: branchContext
          });
        }

        setRepoContents(prev => prev.filter(f => f.path !== fileToDelete.path));
        showToast(`Deleted folder ${fileToDelete.name}`);
      } catch (error) {
        showToast(`Failed to delete folder ${fileToDelete.name}`, 'error');
      } finally {
        setLoadingState('');
      }
      return;
    }

    if (!window.confirm(`Delete ${fileToDelete.name}?`)) return;

    setPendingOps(prev => ({ ...prev, [fileToDelete.path]: { action: 'delete' } }));
    if (activeFileRef.current?.path === fileToDelete.path) {
      setActiveFile(null);
      setContent(defaultContent || '');
    }
    showToast(`Deleting ${fileToDelete.name}...`);

    try {
      if (pendingOps[fileToDelete.path]?.action === 'add') {
        setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
        return;
      }

      const body = { 
        message: `Delete ${fileToDelete.name} via Git Markdown Editor`, 
        sha: fileToDelete.sha,
        branch: branchContext
      };
      await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToDelete.path}`, 'DELETE', body);

      // Clean cache
      const fullPath = getStoragePath(fileToDelete.path, currentRepoRef.current, branchContext);
      await storage.deleteFile(fullPath);

      setRepoContents(prev => prev.filter(f => f.path !== fileToDelete.path));
      setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
      showToast(`Deleted ${fileToDelete.name}`);
      
      const currentDirPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
      fetchRepoContents(currentRepoRef.current, currentDirPath, branchContext);
    } catch (_error) {
      showToast(`Failed to delete ${fileToDelete.name}`, 'error');
      setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
    }
  }, [apiRequest, fetchRepoContents, pendingOps, setActiveFile, setContent, setPendingOps, showToast, activeFileRef, pathStack, getStoragePath]);

  const createFile = useCallback(async (fileName, initialContent = '', parentPath = null) => {
    const currentPath = parentPath !== null ? parentPath : (pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '');
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const branchContext = currentBranchRef.current;

    if (!currentRepoRef.current) return;

    const tempFile = { name: fileName, path: filePath, type: 'file', sha: null, content: initialContent, repo: currentRepoRef.current, branch: branchContext };
    setPendingOps(prev => ({ ...prev, [filePath]: { action: 'add', file: tempFile, content: initialContent } }));
    setActiveFile(tempFile);
    setContent(initialContent);
    showToast(`Creating ${fileName}...`); 

    try {
      const body = { 
        message: `Create ${fileName} via Git Markdown Editor`, 
        content: utf8_to_b64(initialContent),
        branch: branchContext
      };
      const data = await apiRequest(`/repos/${currentRepoRef.current}/contents/${filePath}`, 'PUT', body);
      
      // Update cache
      const fullPath = getStoragePath(filePath, currentRepoRef.current, branchContext);
      await Promise.all([
        storage.saveOriginal(fullPath, initialContent),
        storage.saveDraft(fullPath, initialContent)
      ]);

      const newFileEntry = { name: fileName, path: filePath, type: 'file', sha: data.content.sha };
      setRepoContents(prev => {
        const filtered = prev.filter(f => f.path !== filePath);
        return [...filtered, newFileEntry].sort((a, b) => {
           if (a.type === b.type) return a.name.localeCompare(b.name);
           return a.type === 'dir' ? -1 : 1;
        });
      });

      setPendingOps(prev => { const newState = { ...prev }; delete newState[filePath]; return newState; });
      setActiveFile(prev => prev && prev.path === filePath ? { ...prev, sha: data.content.sha } : prev);
      fetchRepoContents(currentRepoRef.current, currentPath, branchContext);
      showToast(`Synced ${fileName}`);
    } catch (_error) {
      showToast(`Failed to create file: ${fileName}`, 'error');
      setPendingOps(prev => { const newState = { ...prev }; delete newState[filePath]; return newState; });
      setActiveFile(prev => prev && prev.path === filePath ? null : prev);
    }
  }, [apiRequest, fetchRepoContents, pathStack, setActiveFile, setContent, setPendingOps, showToast, getStoragePath]);

  const createFolder = useCallback(async (folderName, parentPath = null) => {
    const currentPath = parentPath !== null ? parentPath : (pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '');
    const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    const branchContext = currentBranchRef.current;

    if (!currentRepoRef.current) return;

    showToast(`Creating folder ${folderName}...`); 

    try {
      const body = { 
        message: `Create folder ${folderName} via Git Markdown Editor`, 
        content: utf8_to_b64(''), // Empty content for .gitkeep
        branch: branchContext
      };
      await apiRequest(`/repos/${currentRepoRef.current}/contents/${folderPath}/.gitkeep`, 'PUT', body);
      
      const newDirEntry = { name: folderName, path: folderPath, type: 'dir' };
      setRepoContents(prev => {
        const filtered = prev.filter(f => f.path !== folderPath);
        return [...filtered, newDirEntry].sort((a, b) => {
           if (a.type === b.type) return a.name.localeCompare(b.name);
           return a.type === 'dir' ? -1 : 1;
        });
      });
      showToast(`Created folder ${folderName}`);
    } catch (_error) {
      showToast(`Failed to create folder: ${folderName}`, 'error');
    }
  }, [apiRequest, fetchRepoContents, pathStack, showToast]);

  const loadTOC = useCallback(async (file) => {
    if (file.type === 'dir') return;
    if (!file.name.match(/\.(md|txt|mdx)$/i)) {
      showToast('TOC only supported for Markdown files', 'error');
      return;
    }

    // Load the file into the editor, which will automatically trigger the preview and TOC generation
    loadFile(file);
    
    // Push the file onto the pathStack to switch the sidebar into TOC view
    setPathStack(prev => [...prev, { ...file, isTOC: true }]);
  }, [loadFile, showToast, setPathStack]);

  const createBranch = useCallback(async (branchName) => {
    if (!currentRepoRef.current || !currentBranchRef.current) return;
    setLoadingState('saving');
    try {
      const branchData = await apiRequest(`/repos/${currentRepoRef.current}/branches/${currentBranchRef.current}`);
      const sha = branchData.commit.sha;
      
      await apiRequest(`/repos/${currentRepoRef.current}/git/refs`, 'POST', {
        ref: `refs/heads/${branchName}`,
        sha: sha
      });
      
      showToast(`Created branch ${branchName}`);
      
      const branchesData = await apiRequest(`/repos/${currentRepoRef.current}/branches`);
      setBranches(branchesData);
      setCurrentBranch(branchName);
      fetchRepoContents(currentRepoRef.current, '', branchName);
    } catch (_error) {
      showToast(`Failed to create branch: ${_error.message}`, 'error');
    }
    setLoadingState('');
  }, [apiRequest, fetchRepoContents, setLoadingState, showToast]);

  useEffect(() => {
    const savedToken = localStorage.getItem('gme_gh_token');
    if (savedToken) {
      verifyGitHubToken(savedToken, true);
    } else {
      // Clear GitHub-related state if no token is found
      setGhUser(null);
      setCurrentRepo(null);
      setRepoContents([]);
      setBranches([]);
      setCurrentBranch('');
    }
  }, [verifyGitHubToken]);

  // Restore repo contents and branches on reload
  useEffect(() => {
    if (ghUser && currentRepo && repoContents.length === 0) {
      const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
      fetchRepoContents(currentRepo, currentPath, currentBranch);
    }
  }, [ghUser, currentRepo, repoContents.length, currentBranch, fetchRepoContents, pathStack]);

  return {
    ghToken, setGhToken,
    ghUser, setGhUser,
    repos, setRepos,
    currentRepo, setCurrentRepo,
    currentRepoRef,
    repoContents, setRepoContents,
    branches, setBranches,
    currentBranch, setCurrentBranch,
    currentBranchRef,
    manualRepo, setManualRepo,
    hiddenRepos, setHiddenRepos,
    apiRequest,
    fetchRepos,
    verifyGitHubToken,
    fetchRepoContents,
    saveToGitHub,
    loadFile,
    renameFile,
    deleteFile,
    createFile,
    createFolder,
    loadTOC,
    createBranch
  };
}
