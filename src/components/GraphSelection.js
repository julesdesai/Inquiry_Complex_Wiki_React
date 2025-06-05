// src/components/GraphSelection.js
import React, { useState } from 'react';
import { BookOpen, BrainCircuit, Database, FileText } from 'lucide-react';

// Configuration for available question graphs with detailed information
const QUESTION_GRAPH_CONFIG = {
  'knowledge': {
    name: 'What is Knowledge?',
    description: 'The Socratic Question',
    icon: <BrainCircuit className="w-6 h-6" />
  },
  'freedom': {
    name: 'What is Freedom (in the sense of Liberty)?',
    description: 'Philosophical perspectives on freedom and liberty',
    icon: <BrainCircuit className="w-6 h-6" />
  },
  'human_flourishing': {
    name: 'What is Human Flourishing?',
    description: 'Philosophical perspectives on human flourishing',
    icon: <BrainCircuit className="w-6 h-6" />
  },
  'AGI': {
    name: 'What is the right definition of AGI (artificial general intelligence)?',
    description: 'Philosophical perspectives on AGI',
    icon: <BrainCircuit className="w-6 h-6" />
  },
  'reasons': {
    name: 'What are Reasons?',
    description: 'Philosophical perspectives on reasons',
    icon: <BrainCircuit className="w-6 h-6" />
  },
  'semantics': {
    name: 'What is Semantics?',
    description: 'Philosophical perspectives on semantics',
    icon: <BrainCircuit className="w-6 h-6" />
  }
};

// Configuration for text graphs
const TEXT_GRAPH_CONFIG = {
  'lewis-counterfactual-dependence-times-arrow': {
    name: 'Counterfactual Dependence and Time\'s Arrow',
    author: 'David Lewis',
    description: 'Lewis on the asymmetry of counterfactuals and time',
    icon: <BookOpen className="w-6 h-6" />
  },
  'frankfurt-alternate-possibilities-and_moral-responsibility': {
    name: 'Alternate Possibilities and Moral Responsibility',
    author: 'Harry Frankfurt',
    description: 'Frankfurt on moral responsibility without alternate possibilities',
    icon: <BookOpen className="w-6 h-6" />
  }
};

const GraphSelection = ({ onSelectGraph }) => {
  const [error, setError] = useState(null);
  
  // Create question graphs array from config
  const questionGraphs = Object.entries(QUESTION_GRAPH_CONFIG).map(([id, config]) => ({
    id,
    name: config.name,
    description: config.description,
    icon: config.icon
  }));

  // Create text graphs array from config
  const textGraphs = Object.entries(TEXT_GRAPH_CONFIG).map(([id, config]) => ({
    id,
    name: config.name,
    author: config.author,
    description: config.description,
    icon: config.icon
  }));

  const renderGraphGrid = (graphs, title) => (
    <div className="mb-12">
      <h2 className="text-2xl font-semibold mb-6 text-stone-800">{title}</h2>
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
              {graph.author && (
                <p className="text-stone-500 italic mb-2">{graph.author}</p>
              )}
              <p className="text-stone-600 mb-2">{graph.description}</p>
            </div>
          </button>
        ))}
        
        {graphs.length === 0 && (
          <div className="col-span-2 text-center py-10 text-stone-500">
            No graphs available in this category.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-8 border border-stone-100">
          <h1 className="text-4xl font-bold mb-2 text-stone-800">Inquiry Complex Wiki</h1>
          <p className="text-stone-600 mb-8">Select an Inquiry Complex to explore</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          {renderGraphGrid(questionGraphs, "Questions")}
          {renderGraphGrid(textGraphs, "Texts")}
        </div>
      </div>
    </div>
  );
};

export default GraphSelection;