import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadInquiryComplexToFirebase, findRootNode } from '../services/textProcessingService';

const TextUpload = ({ onUploadComplete, onCancel }) => {
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'text/plain') {
      setError('Please select a plain text file (.txt)');
      return;
    }

    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setTextContent(e.target.result);
    };
    reader.readAsText(selectedFile);
  };

  const handleTextPaste = (event) => {
    setTextContent(event.target.value);
    setFile(null);
  };

  const handleUpload = async () => {
    if (!name.trim()) {
      setError('Please enter a name for the text');
      return;
    }

    if (!textContent.trim()) {
      setError('Please provide text content either by uploading a file or pasting text');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Step 1: Process text with Python script
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? '/api/process-text' 
        : 'http://localhost:3001/api/process-text';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          author: author.trim(),
          description: description.trim(),
          textContent: textContent.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }

      const processResult = await response.json();
      
      if (!processResult.success) {
        throw new Error(processResult.error || 'Text processing failed');
      }

      // Step 2: Upload to Firebase
      const { data } = processResult;
      const collectionName = data.collectionName;
      const inquiryComplex = data.inquiryComplex;
      
      console.log('🔥 About to upload to Firebase...');
      console.log('Collection name:', collectionName);
      console.log('Inquiry complex keys:', Object.keys(inquiryComplex));
      console.log('Metadata:', data.metadata);
      
      const uploadResult = await uploadInquiryComplexToFirebase(collectionName, inquiryComplex, data.metadata);
      console.log('✅ Firebase upload completed:', uploadResult);
      
      setSuccess(true);
      
      setTimeout(() => {
        onUploadComplete({
          collectionName,
          rootNodeId: uploadResult.rootNodeId,
          name: data.name,
          author: data.author,
          description: data.description,
          metadata: uploadResult.metadata
        });
      }, 1500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to process text. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setAuthor('');
    setDescription('');
    setTextContent('');
    setFile(null);
    setError(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 border border-stone-100 max-w-md w-full mx-4">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-stone-800 mb-2">Upload Successful!</h2>
            <p className="text-stone-600">Your text has been processed and added to the wiki.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-8 border border-stone-100">
          <h1 className="text-3xl font-bold mb-2 text-stone-800">Upload Text</h1>
          <p className="text-stone-600 mb-8">Upload a text file or paste content to create a new inquiry complex</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                placeholder="Enter a name for this text"
                disabled={uploading}
              />
            </div>

            <div>
              <label htmlFor="author" className="block text-sm font-medium text-stone-700 mb-2">
                Author
              </label>
              <input
                type="text"
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                placeholder="Enter the author name"
                disabled={uploading}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-stone-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="3"
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                placeholder="Enter a description for this text"
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Text Content *
              </label>
              
              <div className="border-2 border-dashed border-stone-300 rounded-lg p-6 mb-4">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-stone-400 mx-auto mb-4" />
                  <p className="text-stone-600 mb-2">Upload a text file or paste content below</p>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-md hover:bg-stone-200 cursor-pointer transition"
                  >
                    <Upload className="w-4 h-4" />
                    Choose File
                  </label>
                  {file && (
                    <p className="text-sm text-stone-500 mt-2">
                      Selected: {file.name}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="text-content" className="block text-sm font-medium text-stone-700 mb-2">
                  Or paste text content:
                </label>
                <textarea
                  id="text-content"
                  value={textContent}
                  onChange={handleTextPaste}
                  rows="10"
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent font-mono text-sm"
                  placeholder="Paste your text content here..."
                  disabled={uploading}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={handleUpload}
              disabled={uploading || !name.trim() || !textContent.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-stone-800 text-white rounded-md hover:bg-stone-900 disabled:bg-stone-400 disabled:cursor-not-allowed transition"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload and Process
                </>
              )}
            </button>
            
            <button
              onClick={onCancel}
              disabled={uploading}
              className="px-6 py-3 bg-stone-100 text-stone-700 rounded-md hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Cancel
            </button>
            
            <button
              onClick={handleReset}
              disabled={uploading}
              className="px-6 py-3 bg-stone-100 text-stone-700 rounded-md hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextUpload;