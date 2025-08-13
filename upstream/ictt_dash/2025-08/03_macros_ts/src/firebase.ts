import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'macros-5f654',
  appId: '1:105426879918:web:6f2cbc473489b76e07f43f',
  storageBucket: 'macros-5f654.firebasestorage.app',
  apiKey: 'AIzaSyBAVNVyQn3oej4b1QGV94W9dgYqCS1vekU',
  authDomain: 'macros-5f654.firebaseapp.com',
  messagingSenderId: '105426879918',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
