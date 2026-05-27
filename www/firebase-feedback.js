import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWxI2W7D5gSN4mobZfmqsWT0HCLH0aJ6g",
  authDomain: "fretchamp.firebaseapp.com",
  projectId: "fretchamp",
  storageBucket: "fretchamp.firebasestorage.app",
  messagingSenderId: "2970188550",
  appId: "1:2970188550:web:bc34e1c5699c184e0c3c87"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const btn = document.getElementById('feedback-btn');
const modal = document.getElementById('feedback-modal');
const closeBtn = document.getElementById('feedback-close');
const submitBtn = document.getElementById('feedback-submit');
const textarea = document.getElementById('feedback-text');
const nameInput = document.getElementById('feedback-name');

btn.addEventListener('click', () => {
  modal.style.display = 'flex';
  textarea.focus();
});

closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
  textarea.value = '';
  nameInput.value = '';
});

submitBtn.addEventListener('click', async () => {
  const text = textarea.value.trim();
  if (!text) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    await addDoc(collection(db, 'feedback'), {
      name: nameInput.value.trim() || 'Anonymous',
      text,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
    modal.style.display = 'none';
    textarea.value = '';
    nameInput.value = '';
    submitBtn.textContent = 'Send';
    submitBtn.disabled = false;
  } catch (e) {
    console.error('Feedback error:', e);
    submitBtn.textContent = 'Error, try again';
    submitBtn.disabled = false;
  }
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
    textarea.value = '';
    nameInput.value = '';
  }
});

const shareBtn = document.getElementById('share-btn');
const SHARE_URL = 'https://firebasestorage.googleapis.com/v0/b/fretchamp.firebasestorage.app/o/FretChamp.apk?alt=media&token=59cb5a10-fb15-4715-8305-184fb277f490';

shareBtn.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'FretChamp',
        text: 'Check out FretChamp — learn the guitar fretboard!',
        url: SHARE_URL
      });
    } catch (e) {
      // user cancelled — do nothing
    }
  } else {
    await navigator.clipboard.writeText(SHARE_URL);
    alert('Link copied to clipboard!');
  }
});
