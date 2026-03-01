// login.js
// Hardcoded credentials: edit this object to change allowed username/password pairs.
const CREDENTIALS = {
    // Example: username: password
    "ghost": "bobo",
    "Chichu": "Kimchi7",
    "Krishna": "Chichu20",
    // Add or change entries here. Only usernames present here can sign in.
    // "somevalue": "yourpassword"
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('username');
    const passInput = document.getElementById('password');
    const msg = document.getElementById('login-msg');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = (userInput.value || '').trim();
        const p = passInput.value || '';

        if (!u) {
            msg.textContent = 'Enter a username';
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(CREDENTIALS, u)) {
            msg.textContent = 'Invalid username';
            return;
        }

        if (CREDENTIALS[u] !== p) {
            msg.textContent = 'Incorrect password';
            return;
        }

        // Success: store session and go to memories page
        sessionStorage.setItem('scrapbook_user', u);
        window.location.href = 'memories.html';
    });
});
