// login.js
// This app now uses Supabase Auth for sign in.
// Create matching Supabase users for the usernames below and use the same passwords.
const SUPABASE_URL = 'https://axmllmliekjkgtxvglnx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VF2mhtEhcH-ylutp2fdJQw_NL-Uu-oK';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const USER_EMAIL_MAP = {
    ghost: 'ghost@example.com',
    Chichu: 'chichu@example.com',
    Krishna: 'krishna@example.com'
};

const ADMIN_USERNAMES = new Set(['ghost']);

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('username');
    const passInput = document.getElementById('password');
    const msg = document.getElementById('login-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = (userInput.value || '').trim();
        const password = passInput.value || '';

        if (!username) {
            msg.textContent = 'Enter a username';
            return;
        }

        const email = USER_EMAIL_MAP[username];
        if (!email) {
            msg.textContent = 'Invalid username';
            return;
        }

        if (!password) {
            msg.textContent = 'Enter a password';
            return;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            msg.textContent = error.message || 'Sign in failed';
            return;
        }

        if (!data?.session) {
            msg.textContent = 'Sign in failed';
            return;
        }

        sessionStorage.setItem('scrapbook_user', username);
        sessionStorage.setItem('scrapbook_is_admin', ADMIN_USERNAMES.has(username) ? 'true' : 'false');
        window.location.href = 'memories.html';
    });
});
