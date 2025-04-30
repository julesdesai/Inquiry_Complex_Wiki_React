// src/components/ExplanationPanel.js - With hashtag headings support
import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen } from 'lucide-react';
import explanationService from '../services/explanationService';

const ExplanationPanel = ({ isOpen, onClose, nodeData, collectionName = 'nodes' }) => {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  
  // Handle clicking outside the panel to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target) && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  // Reset explanation when panel is closed
  useEffect(() => {
    if (!isOpen) {
      setExplanation('');
      setError(null);
    }
  }, [isOpen]);
  
  // Fetch explanation when panel is opened
  useEffect(() => {
    if (isOpen && nodeData) {
      setLoading(true);
      setExplanation('');
      setError(null);
      
      // Add collection name to the node data for parent fetching
      const nodeWithCollection = {
        ...nodeData,
        collectionName: collectionName
      };
      
      explanationService.fetchExplanation(nodeWithCollection)
        .then(result => {
          setExplanation(result);
        })
        .catch(err => {
          console.error('Error fetching explanation:', err);
          setError('Failed to load explanation. Please try again.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, nodeData, collectionName]);

  // Format text with special handling for Markdown-like patterns
  // including ### headings, ** bold text, and more
  const formatText = (text) => {
    if (!text) return text;
    
    // Pre-process: Preserve top-level numbering by converting 
    // numbered items to a custom format temporarily
    let processedText = text.replace(/^(\d+)\.\s+(.*?)$/gm, (match, num, content) => {
      return `<number value="${num}">. ${content}`;
    });
    
    // Handle ### headings (Markdown style)
    processedText = processedText.replace(/^\s*#{1,3}\s+(.+)$/gm, '<h3>$1</h3>');
    
    // Replace standalone ** subheadings ** with styled headings
    processedText = processedText.replace(/^\s*\*\*(.*?)\*\*\s*$/gm, '<h3>$1</h3>');
    
    // Handle inline ** bold ** text that's not a heading
    processedText = processedText.replace(/(?<!\<h3>)(.*?)\*\*(.*?)\*\*(.*?)(?!\<\/h3>)/g, '$1<strong>$2</strong>$3');
    
    // Handle inline * italic * text
    processedText = processedText.replace(/\*((?!\*\*)(.*?)(?!\*\*))\*/g, '<em>$1</em>');
    
    // Handle bullet points
    processedText = processedText.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
    processedText = processedText.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Post-process: Convert our custom number markers back to proper HTML
    // but preserve the original numbers
    processedText = processedText.replace(/<number value="(\d+)">\.\s+(.*?)$/gm, (match, num, content) => {
      return `<div class="numbered-item"><span class="number">${num}.</span> <span class="content">${content}</span></div>`;
    });
    
    return processedText;
  };
  
  // Safely render HTML content
  const createMarkup = (html) => {
    return { __html: html };
  };
  
  if (!isOpen) return null;
  
  const formattedExplanation = formatText(explanation);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 z-40 flex justify-end">
      <div 
        ref={panelRef}
        className="bg-white w-full max-w-2xl h-full shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto"
        style={{ animation: 'slideIn 0.3s ease-out forwards' }}
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-stone-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-stone-600" />
              Explanation
            </h2>
            <button 
              onClick={onClose}
              className="text-stone-500 hover:text-stone-700"
              aria-label="Close explanation panel"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {nodeData && (
            <div className="mb-6 p-4 bg-stone-50 rounded-lg border border-stone-100">
              <h3 className="font-semibold text-stone-700 mb-1">{nodeData.summary}</h3>
              <p className="text-sm text-stone-500">
                {nodeData.node_type.charAt(0).toUpperCase() + nodeData.node_type.slice(1)}
              </p>
            </div>
          )}
          
          <div className="prose prose-stone max-w-none">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-pulse text-stone-500">Writing explanation...</div>
              </div>
            )}
            
            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
                {error}
              </div>
            )}
            
            {!loading && !error && formattedExplanation && (
              <div 
                className="explanation-text"
                dangerouslySetInnerHTML={createMarkup(formattedExplanation)}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Add styles for formatted content */}
      <style jsx="true">{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        .explanation-text {
          line-height: 1.7;
        }
        
        .explanation-text h3 {
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          font-size: 1.25rem;
          font-weight: 600;
          color: #44403c;
        }
        
        .explanation-text p {
          margin-bottom: 1rem;
        }
        
        .explanation-text strong {
          font-weight: 600;
          color: #44403c;
        }
        
        .explanation-text em {
          font-style: italic;
        }
        
        .explanation-text ul {
          padding-left: 1.5rem;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .explanation-text li {
          margin-bottom: 1rem;
          list-style-type: disc;
        }
        
        .explanation-text .numbered-item {
          display: flex;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .explanation-text .numbered-item .number {
          font-weight: 600;
          min-width: 1.5rem;
          margin-right: 0.5rem;
        }
        
        .explanation-text .numbered-item .content {
          flex: 1;
        }
      `}</style>
    </div>
  );
};

export default ExplanationPanel;