import localforage from 'localforage';

// Configure localForage
localforage.config({
  name: 'GitMarkdownEditor',
  storeName: 'files',
  description: 'Stores original and draft versions of markdown files'
});

/**
 * Storage key helpers
 */
const getOriginalKey = (path) => `original_${path}`;
const getDraftKey = (path) => `draft_${path}`;
const getShaKey = (path) => `sha_${path}`;

/**
 * File Storage API
 */
export const storage = {
  // Save SHA for cache validation
  async saveSha(path, sha) {
    if (!path) return;
    return localforage.setItem(getShaKey(path), sha);
  },

  // Get stored SHA
  async getSha(path) {
    if (!path) return null;
    return localforage.getItem(getShaKey(path));
  },

  // Save original baseline from GitHub
  async saveOriginal(path, content) {
    if (!path) return;
    return localforage.setItem(getOriginalKey(path), content);
  },

  // Get original baseline
  async getOriginal(path) {
    if (!path) return null;
    return localforage.getItem(getOriginalKey(path));
  },

  // Save active workspace draft
  async saveDraft(path, content) {
    if (!path) return;
    return localforage.setItem(getDraftKey(path), content);
  },

  // Get active workspace draft
  async getDraft(path) {
    if (!path) return null;
    return localforage.getItem(getDraftKey(path));
  },

  // Delete all records for a file (e.g. on file deletion)
  async deleteFile(path) {
    if (!path) return;
    await Promise.all([
      localforage.removeItem(getOriginalKey(path)),
      localforage.removeItem(getDraftKey(path)),
      localforage.removeItem(getShaKey(path))
    ]);
  },

  // Rename records (e.g. on file rename)
  async renameFile(oldPath, newPath) {
    if (!oldPath || !newPath) return;
    const [original, draft, sha] = await Promise.all([
      this.getOriginal(oldPath),
      this.getDraft(oldPath),
      this.getSha(oldPath)
    ]);

    const ops = [];
    if (original !== null) {
      ops.push(this.saveOriginal(newPath, original));
      ops.push(localforage.removeItem(getOriginalKey(oldPath)));
    }
    if (draft !== null) {
      ops.push(this.saveDraft(newPath, draft));
      ops.push(localforage.removeItem(getDraftKey(oldPath)));
    }
    if (sha !== null) {
      ops.push(this.saveSha(newPath, sha));
      ops.push(localforage.removeItem(getShaKey(oldPath)));
    }
    await Promise.all(ops);
  },

  // Clear all records for a specific repo
  async clearRepo(repoPath) {
    if (!repoPath) return;
    const keys = await localforage.keys();
    const prefixOriginal = getOriginalKey(repoPath + '/');
    const prefixDraft = getDraftKey(repoPath + '/');
    
    const toRemove = keys.filter(key => 
      key.startsWith(prefixOriginal) || key.startsWith(prefixDraft)
    );
    
    await Promise.all(toRemove.map(key => localforage.removeItem(key)));
  },

  // Clear everything (optional helper)
  async clear() {
    return localforage.clear();
  }
};
