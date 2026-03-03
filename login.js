// login.js
// Hashed credentials (SHA-256): secure against casual inspection.
// Note: While better than plain text, client-side auth is never fully secure.
// Consider enabling Netlify Identity for robust protection.
const CREDENTIAL_HASHES = {
    // format: username: sha256_hash_of_password
    "ghost": "bf0c97708b849de696e7373508b13c5ea92bafa972fc941d694443e494a4b84d",
    "Chichu": "88ca9cb6e716aa241b2e1750a6837d060bdecbe95ab4af114446725e12a46841",
    "Krishna": "a2b99b91650e3ebd173c62362887ac33d05ff780230dcaa677d9f4e97fa86ae1"
};

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('username');
    const passInput = document.getElementById('password'); // Kept ID for compatibility with HTML update later
    const msg = document.getElementById('login-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = (userInput.value || '').trim();
        const p = passInput.value || '';

        if (!u) {
            msg.textContent = 'Enter a username';
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(CREDENTIAL_HASHES, u)) {
            msg.textContent = 'Invalid username';
            return;
        }

        const inputHash = await sha256(p);

        if (CREDENTIAL_HASHES[u] !== inputHash) {
            msg.textContent = 'Incorrect access code';
            return;
        }

        // Success: store session and go to memories page
        sessionStorage.setItem('scrapbook_user', u);
        window.location.href = 'memories.html';
    });
});
