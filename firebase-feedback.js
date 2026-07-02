const FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/fretchamp/databases/(default)/documents/feedback?key=AIzaSyDWxI2W7D5gSN4mobZfmqsWT0HCLH0aJ6g';

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
    const res = await fetch(FIRESTORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          text:      { stringValue: text },
          userAgent: { stringValue: navigator.userAgent },
          timestamp: { stringValue: new Date().toISOString() }
        }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');

function renderHighScores() {
  const modes = {
    single: 'Single Note',
    triads: 'Triads',
    fourInverts: '7th Inversions',
    slash: 'Slash Chords',
    sevenths: '7th Chords',
    freeplay: 'Scales',
    basicchord: 'Beginners Trainer'
  };
  const rows = Object.entries(modes).map(([key, name]) => {
    const hs = localStorage.getItem(`hs_${key}`);
    const val = hs ? hs : '—';
    const color = hs ? '#ffd700' : 'rgba(255,255,255,0.35)';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:14px;color:rgba(255,255,255,0.85);">${name}</span>
      <span style="font-size:15px;font-weight:bold;color:${color};">${val}</span>
    </div>`;
  }).join('');
  document.getElementById('hs-list').innerHTML = rows;
}

settingsBtn.addEventListener('click', () => {
  renderHighScores();
  settingsModal.style.display = 'flex';
});
settingsClose.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.style.display = 'none';
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
