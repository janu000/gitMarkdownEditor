import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const Toast = ({ type, message }) => (
  <div className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-lg shadow-xl border ${
    type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' : 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
  } transition-all duration-300 animate-in fade-in slide-in-from-top-4`}>
    {type === 'error' ? <AlertCircle className="w-5 h-5 mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
    {message}
  </div>
);

export default Toast;
