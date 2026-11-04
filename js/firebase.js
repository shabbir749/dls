// 1) Firebase Console → Project settings → Your apps → Web app → paste the config here.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,setDoc,addDoc,deleteDoc,collection,onSnapshot,query,where,orderBy,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const cfg={apiKey:'AIzaSyCrPrarEGnb1JKc61rzGG5LzKwVlNMCTZM',authDomain:'dls-tournament-hub-74d7d.firebaseapp.com',projectId:'dls-tournament-hub-74d7d',appId:'1:402728936655:web:ccf9e3d242057df7b383ba'};
export const configured=cfg.apiKey!=='1:402728936655:web:ccf9e3d242057df7b383ba';
const app=initializeApp(cfg);
export const auth=getAuth(app),db=getFirestore(app);
export{GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,onAuthStateChanged,signOut,doc,getDoc,getDocs,setDoc,addDoc,deleteDoc,collection,onSnapshot,query,where,orderBy,runTransaction,serverTimestamp};
