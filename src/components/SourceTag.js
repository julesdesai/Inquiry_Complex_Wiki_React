// src/components/SourceTag.js
import React from 'react';
import { User, Sparkles } from 'lucide-react';

/**
 * A small elegant tag indicating whether content was human or AI generated
 * @param {Object} props
 * @param {boolean} props.userGenerated - Whether the content was user generated
 * @param {string} props.className - Additional classes to apply
 */
const SourceTag = ({ userGenerated, className = '' }) => {
  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        userGenerated 
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
      } ${className}`}
      title={userGenerated ? 'Human generated content' : 'AI generated content'}
    >
      {userGenerated ? (
        <>
          <User className="w-3 h-3" />
          <span className="hidden sm:inline">Human</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3 h-3" />
          <span className="hidden sm:inline">AI</span>
        </>
      )}
    </span>
  );
};

export default SourceTag;