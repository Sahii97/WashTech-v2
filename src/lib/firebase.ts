import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyDRxH5dqU0RanerfWCTYuI2WR5Cv43K2sU',
  authDomain:        'gen-lang-client-0754111363.firebaseapp.com',
  projectId:         'gen-lang-client-0754111363',
  storageBucket:     'gen-lang-client-0754111363.firebasestorage.app',
  messagingSenderId: '271263579220',
  appId:             '1:271263579220:web:8aae94d14a4d96f38d01c1',
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, 'ai-studio-ae98497f-378e-4913-8fbf-662dadf0b548');
