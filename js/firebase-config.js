// Firebase 초기화 및 기능을 다른 파일에서도 쓸 수 있도록 전역 객체에 할당 (간소화)
// ※ 실제 서비스 배포 시 이 부분에 사용자의 Firebase Config 값을 채워넣어야 합니다.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy,
    serverTimestamp,
    doc,
    setDoc,
    getDoc,
    getDocFromServer,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCSp9WI8yVtBZrpY80ILAmMutP_sVKmpdc",
  authDomain: "keiti-union.firebaseapp.com",
  projectId: "keiti-union",
  storageBucket: "keiti-union.firebasestorage.app",
  messagingSenderId: "1061152447961",
  appId: "1:1061152447961:web:45f7f46f24982dfaf0cdc8"
};

// 1. Firebase 초기화 (키가 없으면 Mock 모드로 동작하도록 안전장치)
let app, auth, db;
let isFirebaseInitialized = false;

try {
    if(Object.keys(firebaseConfig).length > 0) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseInitialized = true;
        console.log("Firebase initialized successfully.");
    } else {
        console.warn("Firebase Config가 비어있습니다. 현재 UI 테스트(Mock) 모드로 동작합니다.");
    }
} catch (error) {
    console.error("Firebase 초기화 에러:", error);
}

// 2. 다른 스크립트(app.js)에서 사용할 수 있도록 window 객체에 바인딩
window.keitiFirebase = {
    auth: isFirebaseInitialized ? auth : null,
    db: isFirebaseInitialized ? db : null,
    isInit: isFirebaseInitialized,
    
    // 모듈 임포트 함수들도 외부 노출
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    doc,
    setDoc,
    getDoc,
    getDocFromServer,
    updateDoc,
    deleteDoc
};
