import { useState, useEffect, useCallback, useRef } from 'react';
import { utf8_to_b64, b64_to_utf8 } from '../utils/encoding';

export default function useGitHub(showToast, setLoadingState, {
  content, setContent,
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
  const [currentRepo, setCurrentRepo] = useState(null);
  const currentRepoRef = useRef(null);
  const [repoContents, setRepoContents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const currentBranchRef = useRef('');
  const [manualRepo, setManualRepo] = useState('');
  const [hiddenRepos, setHiddenRepos] = useState(() => JSON.parse(localStorage.getItem('gme_hidden_repos') || '[]'));

  // Sync refs for async callbacks
  useEffect(() => { currentRepoRef.current = currentRepo; }, [currentRepo]);
  useEffect(() => { currentBranchRef.current = currentBranch; }, [currentBranch]);
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
      
      if (repoFullName !== currentRepo || !targetBranch || forceRefreshBranches) {
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
      const data = await apiRequest(`/repos/${currentRepoRef.current}/contents/${file.path}?ref=${currentBranchRef.current}`, 'GET', null, null, !forceFresh);
      const decodedContent = b64_to_utf8(data.content);
      setContent(decodedContent);
      setActiveFile({ path: file.path, sha: data.sha, name: file.name });
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
    
    setLoadingState('saving');
    // Optimistic Update
    setPendingOps(prev => ({ 
      ...prev, 
      [currentActiveFile.path]: { action: 'add', file: { ...currentActiveFile, status: 'pending' }, content: content } 
    }));
    showToast(`Committing ${currentActiveFile.name}...`);

    try {
      const body = {
        message: `Update ${currentActiveFile.name} via Git Markdown Editor`,
        content: utf8_to_b64(content),
        sha: currentActiveFile.sha,
        branch: branchContext
      };
      const data = await apiRequest(`/repos/${repoContext}/contents/${currentActiveFile.path}`, 'PUT', body);
      const updatedFile = { ...currentActiveFile, sha: data.content.sha };
      
      setPendingOps(prev => { const newState = { ...prev }; delete newState[currentActiveFile.path]; return newState; });
      setActiveFile(updatedFile);
      showToast('Successfully committed to GitHub!');
      await loadFile(updatedFile, true);
    } catch (_error) {
      setPendingOps(prev => { const newState = { ...prev }; delete newState[currentActiveFile.path]; return newState; });
      showToast('Failed to save to GitHub', 'error');
    }
    setLoadingState('');
  }, [apiRequest, content, setActiveFile, setPendingOps, setLoadingState, showToast, activeFileRef, loadFile]);

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
      setContent('');
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
