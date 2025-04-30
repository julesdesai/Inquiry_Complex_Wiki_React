// src/components/GraphSelection.js
import React, { useState } from 'react';
import { BookOpen, Database } from 'lucide-react';

// Configuration for available graphs with detailed information
const GRAPH_CONFIG = {
  'knowledge': {
    name: 'What is Knowledge?',
    description: 'The Socratic Question',
    icon: <BookOpen className="w-6 h-6" />
  },
  'freedom': {
    name: 'What is Freedom (in the sense of Liberty)?',
    description: 'Philosophical perspectives on freedom and liberty',
    icon: <BookOpen className="w-6 h-6" />
  },
  'reasons': {
    name: 'What are Reasons?',
    description: 'Philosophical perspectives on reasons',
    icon: <BookOpen className="w-6 h-6" />
  },
  'semantics': {
    name: 'What is Semantics?',
    description: 'Philosophical perspectives on semantics',
    icon: <BookOpen className="w-6 h-6" />
  }
};

const GraphSelection = ({ onSelectGraph }) => {
  const [error, setError] = useState(null);
  
  // Create graphs array directly from config without counts
  const graphs = Object.entries(GRAPH_CONFIG).map(([id, config]) => ({
    id,
    name: config.name,
    description: config.description,
    icon: config.icon
  }));

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-8 border border-stone-100 mb-12">
          <h1 className="text-4xl font-bold mb-2 text-stone-800">Inquiry Complex Wiki</h1>
          <p className="text-stone-600 mb-6">Select an Inquiry Complex to explore</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          <div className="grid gap-6 md:grid-cols-2">
            {graphs.map((graph) => (
              <button
                key={graph.id}
                onClick={() => onSelectGraph(graph.id)}
                className="bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg p-6 text-left transition flex items-start gap-4"
              >
                <div className="p-3 bg-stone-100 text-stone-600 rounded-lg">
                  {graph.icon || <Database className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-stone-800">{graph.name}</h3>
                  <p className="text-stone-600 mb-2">{graph.description}</p>
                </div>
              </button>
            ))}
            
            {graphs.length === 0 && (
              <div className="col-span-2 text-center py-10 text-stone-500">
                No graphs available. Please check your database configuration.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphSelection;