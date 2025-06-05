// src/components/NodeCreationInterface.js
import React, { useState, useRef } from 'react';
import { Plus, ChevronDown, Loader, Check, X, AlertCircle } from 'lucide-react';
import { generateNodePreview, getPossibleChildNodeTypes, isTerminalNodeType, saveNodeToFirebase } from '../services/nodeGenerationService';

const NodeCreationInterface = ({ node, collectionName, onSuccess }) => {
  // State for user inputs and flow control
  const [userInput, setUserInput] = useState('');
  const [selectedNodeType, setSelectedNodeType] = useState(null);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [candidateNode, setCandidateNode] = useState(null);
  
  // Ref for text area auto height
  const textAreaRef = useRef(null);
  
  // Get possible child node types for this parent
  const possibleChildTypes = getPossibleChildNodeTypes(node.node_type);
  const isTerminalType = ['reason', 'direct_reply'].includes(node.node_type);
  const canGenerateChildren = possibleChildTypes.length > 0 && !node.terminal && !isTerminalType;
  
  // Auto resize text area
  const adjustTextAreaHeight = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
    }
  };
  
  // Handle user input change
  const handleInputChange = (e) => {
    setUserInput(e.target.value);
    adjustTextAreaHeight();
  };
  
  // Handle node type selection
  const handleSelectNodeType = (type) => {
    setSelectedNodeType(type);
    setIsTypeMenuOpen(false);
    
    // Focus on text area after selection
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  };
  
  // Generate node preview
  const handleGeneratePreview = async () => {
    if (!selectedNodeType || !userInput.trim()) {
      setError('Please select a node type and enter your content.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setCandidateNode(null);
    
    try {
      const preview = await generateNodePreview(
        node, 
        selectedNodeType, 
        userInput,
        collectionName
      );
      
      setCandidateNode(preview);
    } catch (err) {
      console.error('Error generating node preview:', err);
      setError(err.message || 'Failed to generate node preview');
    } finally {
      setLoading(false);
    }
  };
  
  // Save node to firebase
  const handleSaveNode = async () => {
    if (!candidateNode) return;
    
    setLoading(true);
    
    try {
      const savedNode = await saveNodeToFirebase(
        candidateNode,
        node.id, // Parent ID
        collectionName
      );
      
      // Reset the interface
      setUserInput('');
      setSelectedNodeType(null);
      setCandidateNode(null);
      
      // Notify parent component
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess([savedNode]);
      }
    } catch (err) {
      console.error('Error saving node:', err);
      setError(err.message || 'Failed to save node');
    } finally {
      setLoading(false);
    }
  };
  
  // Cancel and reset
  const handleCancel = () => {
    setCandidateNode(null);
    // Optionally reset other fields too
    // setUserInput('');
    // setSelectedNodeType(null);
  };
  
  // Format node type name for display
  const formatNodeType = (type) => {
    if (type === 'direct_reply') return 'Direct Reply';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  
  // If no possible child types, don't render anything
  if (!canGenerateChildren) {
    return null;
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-8 mb-6 border border-stone-100">
      <h2 className="text-2xl font-semibold text-stone-800 mb-4">Extend This Node</h2>
      
      {/* Node Type Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Generate a new child node of type:
        </label>
        <div className="relative">
          <button
            onClick={() => setIsTypeMenuOpen(!isTypeMenuOpen)}
            disabled={loading || candidateNode}
            className="w-full md:w-auto flex items-center justify-between gap-2 px-4 py-2 bg-stone-100 text-stone-800 rounded-md hover:bg-stone-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {selectedNodeType 
              ? `${formatNodeType(selectedNodeType)}`
              : "Select node type"}
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {isTypeMenuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border border-stone-200 z-10 min-w-[200px]">
              <div className="py-1">
                {possibleChildTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleSelectNodeType(type)}
                    className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 transition"
                  >
                    {formatNodeType(type)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Contextual help */}
        {selectedNodeType && (
          <p className="text-xs text-stone-500 mt-1">
            {selectedNodeType === 'thesis' && 'A thesis presents a philosophical position or claim.'}
            {selectedNodeType === 'antithesis' && 'An antithesis challenges or contradicts the thesis.'}
            {selectedNodeType === 'synthesis' && 'A synthesis reconciles or combines the thesis and antithesis.'}
            {selectedNodeType === 'reason' && 'A reason provides support or justification for the thesis.'}
            {selectedNodeType === 'direct_reply' && 'A direct reply addresses the objection without changing the original view.'}
          </p>
        )}
      </div>
      
      {/* User Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Your Idea:
        </label>
        <textarea
          ref={textAreaRef}
          value={userInput}
          onChange={handleInputChange}
          placeholder="Enter your philosophical idea here... It will be restructured with AI and merged with the graph if you commit the preview."
          disabled={loading || candidateNode}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-md resize-none min-h-[120px] disabled:opacity-60 disabled:cursor-not-allowed"
          rows={4}
        />
      </div>
      
      {/* Generate Button */}
      {!candidateNode && (
        <div className="flex justify-end">
          <button
            onClick={handleGeneratePreview}
            disabled={loading || !selectedNodeType || !userInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Generate Preview
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Candidate Node Preview */}
      {candidateNode && (
        <div className="mt-6 border border-indigo-200 rounded-lg bg-indigo-50 p-4">
          <h3 className="text-lg font-semibold text-indigo-800 mb-2">Preview</h3>
          
          {/* Summary */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-indigo-700 mb-1">
              Summary:
            </label>
            <div className="bg-white p-3 rounded border border-indigo-100">
              {candidateNode.summary}
            </div>
          </div>
          
          {/* Content */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-indigo-700 mb-1">
              Content:
            </label>
            <div className="bg-white p-3 rounded border border-indigo-100 max-h-[300px] overflow-y-auto">
              {candidateNode.content.split('},').map((component, index) => (
                <div key={index} className="mb-2 last:mb-0">
                  <p>{component.replace(/[{}]/g, '').trim()}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-800 rounded-md hover:bg-stone-300 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={handleSaveNode}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Commit to Graph
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeCreationInterface;