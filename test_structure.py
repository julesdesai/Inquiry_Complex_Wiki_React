#!/usr/bin/env python3

import sys
import os
import json

# Add the src/python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'python'))

from text_to_IC import InquiryComplexExtractor

def test_text_structure():
    """Test that the new text node structure works correctly"""
    
    # Sample text content
    test_text = """
    This is a sample philosophical text about consciousness and artificial intelligence.
    It explores questions about what it means to be conscious and whether machines can truly think.
    The text argues that consciousness involves subjective experience that may be difficult to replicate in machines.
    """
    
    # Create extractor with test data
    extractor = InquiryComplexExtractor(
        text_passage=test_text,
        max_depth=2,  # Reduced for testing
        top_n_questions=2,  # Reduced for testing
        text_name="Test Consciousness Text",
        text_description="A sample text exploring consciousness and AI"
    )
    
    # Mock the prompts and LLM functions for testing
    # (In a real test, you'd need the actual prompt files and LLM integration)
    extractor.prompts = {
        'questions': 'Extract questions from: {text_passage}',
        'rank_questions': 'Rank these questions: {list_questions} based on: {text_passage}',
        'thesis': 'Generate thesis for: {central_question} from: {text_passage}',
        'reasons': 'Generate reasons for: {thesis} from: {text_passage}',
        'antithesis': 'Generate antithesis for: {thesis} from: {text_passage}',
        'direct_reply': 'Generate direct reply for: {thesis} vs {antithesis} from: {text_passage}',
        'synthesis': 'Generate synthesis for: {thesis} and {antithesis} from: {text_passage}'
    }
    
    # Create a minimal structure manually for testing
    # Root text node
    text_root_id = extractor.add_node(
        summary="Test Consciousness Text",
        content="A sample text exploring consciousness and AI",
        node_type="text",
        parent_id=None,
        depth=0
    )
    
    # Question nodes as children of text root
    question1_id = extractor.add_node(
        summary="What is consciousness?",
        content="What does it mean to be conscious and how can we define consciousness?",
        node_type="question",
        parent_id=text_root_id,
        depth=1
    )
    
    question2_id = extractor.add_node(
        summary="Can machines think?",
        content="Is it possible for artificial machines to achieve genuine thinking and consciousness?",
        node_type="question",
        parent_id=text_root_id,
        depth=1
    )
    
    # Thesis nodes as children of questions
    thesis1_id = extractor.add_node(
        summary="Consciousness requires subjective experience",
        content="True consciousness involves subjective, first-person experience that cannot be reduced to computational processes",
        node_type="thesis",
        parent_id=question1_id,
        depth=2
    )
    
    # Get the graph structure
    graph = extractor.to_json()
    
    # Verify structure
    print("=== TESTING TEXT NODE STRUCTURE ===")
    print(f"Total nodes: {len(graph)}")
    
    # Find root text node
    root_text_nodes = [
        (node_id, node_data) for node_id, node_data in graph.items()
        if node_data['node_type'] == 'text' and node_data['parent_id'] is None
    ]
    
    print(f"Root text nodes found: {len(root_text_nodes)}")
    
    if root_text_nodes:
        root_id, root_data = root_text_nodes[0]
        print(f"Root node ID: {root_id}")
        print(f"Root node summary: {root_data['summary']}")
        print(f"Root node content: {root_data['content']}")
        print(f"Root node type: {root_data['node_type']}")
        print(f"Root node depth: {root_data['depth']}")
        
        # Find question children
        question_children = [
            (node_id, node_data) for node_id, node_data in graph.items()
            if node_data['parent_id'] == root_id and node_data['node_type'] == 'question'
        ]
        
        print(f"Question children: {len(question_children)}")
        
        for q_id, q_data in question_children:
            print(f"  - Question: {q_data['summary']} (depth: {q_data['depth']})")
            
            # Find thesis children of this question
            thesis_children = [
                (node_id, node_data) for node_id, node_data in graph.items()
                if node_data['parent_id'] == q_id and node_data['node_type'] == 'thesis'
            ]
            
            for t_id, t_data in thesis_children:
                print(f"    - Thesis: {t_data['summary']} (depth: {t_data['depth']})")
    
    # Verify the structure is correct
    success = True
    
    if len(root_text_nodes) != 1:
        print("ERROR: Should have exactly 1 root text node")
        success = False
    
    if root_text_nodes and root_text_nodes[0][1]['summary'] != "Test Consciousness Text":
        print("ERROR: Root text node should have correct summary")
        success = False
    
    print(f"\nTest {'PASSED' if success else 'FAILED'}")
    return success

if __name__ == "__main__":
    test_text_structure()