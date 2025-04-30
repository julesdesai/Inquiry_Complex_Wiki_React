// src/migrateData.js - Optimized migration script
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Your Firebase configuration (replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyC0IRqSD5XoVPiC3yWE84By6fNF8rSM1eA",
    authDomain: "inquirycomplexbackend.firebaseapp.com",
    projectId: "inquirycomplexbackend",
    storageBucket: "inquirycomplexbackend.firebasestorage.app",
    messagingSenderId: "566694921536",
    appId: "1:566694921536:web:28989f87455f408cd966a5",
    measurementId: "G-T1CEV3YDQY"
  };

console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log('Firebase initialized successfully');

// Migration function with smaller batches and better error handling
const migrateJsonToFirestore = async (jsonData) => {
  console.log('Starting migration process...');
  console.log(`Total nodes to migrate: ${Object.keys(jsonData).length}`);
  
  const BATCH_SIZE = 1000; // Smaller batch size to prevent timeouts
  const nodes = Object.entries(jsonData);
  let processedCount = 0;
  let batchCount = 0;
  
  try {
    // Process nodes in chunks
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      batchCount++;
      const chunk = nodes.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      
      // Add documents to current batch
      for (const [id, nodeData] of chunk) {
        const docRef = doc(db, 'semantics', id);
        batch.set(docRef, nodeData);
      }
      
      // Commit the batch with timeout
      console.log(`Committing batch ${batchCount} (documents ${i + 1}-${i + chunk.length})...`);
      
      const commitPromise = batch.commit();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Batch commit timeout')), 30000); // 30 second timeout
      });
      
      try {
        await Promise.race([commitPromise, timeoutPromise]);
        processedCount += chunk.length;
        console.log(`Batch ${batchCount} committed successfully. Total processed: ${processedCount}/${nodes.length}`);
        
        // Add a small delay between batches to prevent overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        if (error.message === 'Batch commit timeout') {
          console.log(`Batch ${batchCount} timed out. Retrying...`);
          // Retry the batch once
          await batch.commit();
          processedCount += chunk.length;
          console.log(`Batch ${batchCount} committed on retry. Total processed: ${processedCount}/${nodes.length}`);
        } else {
          throw error;
        }
      }
    }
    
    console.log(`Migration completed successfully! Total nodes migrated: ${processedCount}`);
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      processed: processedCount
    });
    throw error;
  }
};

// Alternative approach: Single document commits
const migrateOneByOne = async (jsonData) => {
  console.log('Starting one-by-one migration...');
  const nodes = Object.entries(jsonData);
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < nodes.length; i++) {
    const [id, nodeData] = nodes[i];
    try {
      const docRef = doc(db, 'semantics', id);
      await docRef.set(nodeData);
      successCount++;
      
      if ((i + 1) % 10 === 0) {
        console.log(`Progress: ${i + 1}/${nodes.length} (${successCount} successful, ${failCount} failed)`);
      }
    } catch (error) {
      console.error(`Failed to migrate node ${id}:`, error.message);
      failCount++;
    }
  }
  
  console.log(`Migration completed. Success: ${successCount}, Failed: ${failCount}`);
};

// Main function with options
const runMigration = async () => {
  const filePath = process.argv[2] || path.join(process.cwd(), 'data', 'what_is_semantics.json');
  const method = process.argv[3] || 'batch'; // 'batch' or 'single'
  
  try {
    console.log(`Reading file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const graphData = JSON.parse(fileContent);
    
    console.log(`Found ${Object.keys(graphData).length} nodes`);
    console.log(`Using ${method} migration method`);
    
    if (method === 'single') {
      await migrateOneByOne(graphData);
    } else {
      await migrateJsonToFirestore(graphData);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node src/migrateData.js [path-to-json-file] [method]

Arguments:
  path-to-json-file: Path to your graph.json file (default: src/data/graph.json)
  method: Migration method - 'batch' or 'single' (default: batch)

Examples:
  node src/migrateData.js                     # Use defaults
  node src/migrateData.js ./data.json batch   # Use batch method
  node src/migrateData.js ./data.json single  # Use single document method
  `);
  process.exit(0);
}

runMigration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});