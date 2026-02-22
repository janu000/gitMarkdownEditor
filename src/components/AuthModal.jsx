import React from 'react';
import { Github, Loader2 } from 'lucide-react';

const AuthModal = ({ showAuthModal, setShowAuthModal, verifyGitHubToken, loadingState }) => {
  if (!showAuthModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#161b22] border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold mb-2 flex items-center"><Github className="w-6 h-6 mr-2" /> Connect GitHub</h2>
        <p className="text-sm text-gray-400 mb-6">Enter a Personal Access Token (classic) with <code className="bg-gray-800 px-1 rounded">repo</code> scope to sync files.</p>
        <input 
          type="password" 
          placeholder="ghp_xxxxxxxxxxxx" 
          id="pat-input" 
          onKeyDown={(e) => e.key === 'Enter' && verifyGitHubToken(e.target.value)} 
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-4 transition-all" 
        />
        <div className="flex justify-end space-x-3">
          <button onClick={() => setShowAuthModal(false)} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button 
            onClick={() => verifyGitHubToken(document.getElementById('pat-input').value)} 
            disabled={loadingState === 'verifying'} 
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
          >
            {loadingState === 'verifying' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
