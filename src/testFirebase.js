// src/testFirebase.js - Test Firebase connection
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

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

console.log('Testing Firebase connection...');

const testFirebase = async () => {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('Firebase initialized');

    // Test writing a document
    console.log('Testing write operation...');
    const testRef = doc(db, 'test', 'test-doc');
    await setDoc(testRef, {
      test: 'Hello Firebase',
      timestamp: new Date().toISOString()
    });
    console.log('Write successful');

    // Test reading the document
    console.log('Testing read operation...');
    const testDoc = await getDoc(testRef);
    if (testDoc.exists()) {
      console.log('Read successful:', testDoc.data());
    } else {
      console.log('Document not found');
    }

    console.log('Firebase test completed successfully');
  } catch (error) {
    console.error('Firebase test failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

testFirebase();