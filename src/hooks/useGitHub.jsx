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

  const fetchRepoContents = useCallback(async (repoFullName, path = '', branch = null, forceRefreshBranches = false) => {
    setLoadingState('fetching');
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
      setRepoContents(Array.isArray(data) ? data.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      }) : [data]);
      
      setCurrentRepo(repoFullName);
      if (path === '') setPathStack([]);
    } catch (_error) {
      showToast('Failed to fetch folder contents', 'error');
    }
    setLoadingState('');
  }, [apiRequest, currentBranch, currentRepo, setLoadingState, showToast, setPathStack]);

  const loadFile = useCallback(async (file, forceFresh = false) => {
    if (file.type === 'dir') {
      setPathStack(prev => [...prev, file]);
      if (currentRepoRef.current) fetchRepoContents(currentRepoRef.current, file.path);
      return;
    }
    
    if (!file.name.match(/\.(md|txt|mdx)$/i)) {
      showToast('Only Markdown/Text files are supported', 'error');
      return;
    }

    if (!currentRepoRef.current) {
      setContent(file.content || '');
      setActiveFile(file);
      return;
    }

    const pendingOp = pendingOps[file.path];
    if (pendingOp && pendingOp.action === 'add') {
      if (pendingOp.content !== undefined) {
        setContent(pendingOp.content);
        setActiveFile(file);
        return;
      } else {
        showToast('File is syncing, please wait...', 'info');
        return;
      }
    }

    setLoadingState('fetching');
    try {
      // 1. Check for local draft first (unless forceFresh is true)
      const fullPath = `${currentRepoRef.current}/${file.path}`;
      if (!forceFresh) {
        const localDraft = await storage.getDraft(fullPath);
        if (localDraft !== null) {
          setContent(localDraft);
          setActiveFile({ path: file.path, sha: file.sha, name: file.name, type: 'file' });
          setLoadingState('');
          showToast(`Loaded draft for ${file.name}`);
          return;
        }
      }

      // 2. No draft found or force sync requested: Fetch from GitHub
      const data = await apiRequest(`/repos/${currentRepoRef.current}/contents/${file.path}?ref=${currentBranchRef.current}`, 'GET', null, null, !forceFresh);
      const decodedContent = b64_to_utf8(data.content);
      
      // 3. Save to IndexedDB (Original & Draft)
      await Promise.all([
        storage.saveOriginal(fullPath, decodedContent),
        storage.saveDraft(fullPath, decodedContent)
      ]);

      setContent(decodedContent);
      setActiveFile({ path: file.path, sha: data.sha, name: file.name, type: 'file' });
      showToast(forceFresh ? `Synced with GitHub` : `Loaded ${file.name}`);
    } catch (_error) {
      showToast('Failed to load file', 'error');
    }
    setLoadingState('');
  }, [apiRequest, fetchRepoContents, pendingOps, setActiveFile, setContent, setLoadingState, setPathStack, showToast]);

  const saveToGitHub = useCallback(async () => {
    const currentActiveFile = activeFileRef.current;
    const repoContext = currentRepoRef.current; 
    const branchContext = currentBranchRef.current;

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
      const fullPath = `${repoContext}/${currentActiveFile.path}`;
      await storage.saveOriginal(fullPath, content);

      // CRITICAL: Update state with the NEW SHA returned by GitHub
      const newSha = data.content.sha;
      const updatedFile = { ...currentActiveFile, sha: newSha };
      
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
  }, [apiRequest, content, setActiveFile, setPendingOps, setLoadingState, showToast, activeFileRef]);

  const renameFile = useCallback(async (fileToRename) => {
    const newName = prompt(`Rename ${fileToRename.name} to:`, fileToRename.name);
    if (!newName || newName === fileToRename.name) return;

    const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
    const newPath = currentPath ? `${currentPath}/${newName}` : newName;

    if (!currentRepoRef.current) return;

    // Git Mode Rename Optimistic
    const newFile = { ...fileToRename, name: newName, path: newPath };
    setPendingOps(prev => ({
      ...prev,
      [fileToRename.path]: { action: 'delete' },
      [newPath]: { action: 'add', file: newFile }
    }));
    if (activeFileRef.current?.path === fileToRename.path) setActiveFile(newFile);
    showToast(`Renaming to ${newName}...`);

    try {
      const sourceData = await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToRename.path}?ref=${currentBranchRef.current}`);
      const createBody = {
        message: `Rename ${fileToRename.name} to ${newName} via Git Markdown Editor`,
        content: sourceData.content.replace(/\n/g, ''),
        branch: currentBranchRef.current
      };
      const createRes = await apiRequest(`/repos/${currentRepoRef.current}/contents/${newPath}`, 'PUT', createBody);

      const deleteBody = { 
        message: `Rename ${fileToRename.name} to ${newName} (cleanup)`, 
        sha: sourceData.sha, 
        branch: currentBranchRef.current
      };
      await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToRename.path}`, 'DELETE', deleteBody);

      // Keep cache in sync
      const oldFullPath = `${currentRepoRef.current}/${fileToRename.path}`;
      const newFullPath = `${currentRepoRef.current}/${newPath}`;
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
      fetchRepoContents(currentRepoRef.current, currentDirPath);
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
  }, [apiRequest, fetchRepoContents, pathStack, setActiveFile, setPendingOps, showToast, activeFileRef]);

  const deleteFile = useCallback(async (fileToDelete) => {
    if (!window.confirm(`Delete ${fileToDelete.name}?`)) return;

    if (!currentRepoRef.current) return;

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
        branch: currentBranchRef.current
      };
      await apiRequest(`/repos/${currentRepoRef.current}/contents/${fileToDelete.path}`, 'DELETE', body);

      // Clean cache
      const fullPath = `${currentRepoRef.current}/${fileToDelete.path}`;
      await storage.deleteFile(fullPath);

      setRepoContents(prev => prev.filter(f => f.path !== fileToDelete.path));
      setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
      showToast(`Deleted ${fileToDelete.name}`);
      
      const currentDirPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
      fetchRepoContents(currentRepoRef.current, currentDirPath);
    } catch (_error) {
      showToast(`Failed to delete ${fileToDelete.name}`, 'error');
      setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
    }
  }, [apiRequest, fetchRepoContents, pendingOps, setActiveFile, setContent, setPendingOps, showToast, activeFileRef, pathStack]);

  const createFile = useCallback(async (fileName, initialContent = '') => {
    const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;

    if (!currentRepoRef.current) return;

    const tempFile = { name: fileName, path: filePath, type: 'file', sha: null, content: initialContent };
    setPendingOps(prev => ({ ...prev, [filePath]: { action: 'add', file: tempFile, content: initialContent } }));
    setActiveFile(tempFile);
    setContent(initialContent);
    showToast(`Creating ${fileName}...`); 

    try {
      const body = { 
        message: `Create ${fileName} via Git Markdown Editor`, 
        content: utf8_to_b64(initialContent),
        branch: currentBranchRef.current
      };
      const data = await apiRequest(`/repos/${currentRepoRef.current}/contents/${filePath}`, 'PUT', body);
      
      // Update cache
      const fullPath = `${currentRepoRef.current}/${filePath}`;
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
      fetchRepoContents(currentRepoRef.current, currentPath);
      showToast(`Synced ${fileName}`);
    } catch (_error) {
      showToast(`Failed to create file: ${fileName}`, 'error');
      setPendingOps(prev => { const newState = { ...prev }; delete newState[filePath]; return newState; });
      setActiveFile(prev => prev && prev.path === filePath ? null : prev);
    }
  }, [apiRequest, fetchRepoContents, pathStack, setActiveFile, setContent, setPendingOps, showToast]);

  const loadTOC = useCallback(async (file) => {
    if (file.type === 'dir') return;
    if (!file.name.match(/\.(md|txt|mdx)$/i)) {
      showToast('TOC only supported for Markdown files', 'error');
      return;
    }

    let fileContent = '';
    if (!currentRepoRef.current) {
      fileContent = file.content || '';
    } else {
      setLoadingState('fetching');
      try {
        const data = await apiRequest(`/repos/${currentRepoRef.current}/contents/${file.path}?ref=${currentBranchRef.current}`, 'GET', null, null, true);
        fileContent = b64_to_utf8(data.content);
      } catch (_error) {
        showToast('Failed to load file for TOC', 'error');
        setLoadingState('');
        return;
      }
      setLoadingState('');
    }

    updateTOC(fileContent, file.path);
    setPathStack(prev => [...prev, { ...file, isTOC: true }]);
  }, [apiRequest, setLoadingState, showToast, updateTOC, setPathStack]);

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
    loadTOC,
    createBranch
  };
}
