// Initialize Icons
lucide.createIcons();

// Supabase Configuration
const SUPABASE_URL = 'https://axmllmliekjkgtxvglnx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VF2mhtEhcH-ylutp2fdJQw_NL-Uu-oK'; // NOTE: Ideally use env vars, but okay for pure static demo
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const memoryGrid = document.getElementById('memory-grid');
const addCard = document.getElementById('add-card');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('close-modal');
const memoryForm = document.getElementById('memory-form');
const captionInput = document.getElementById('caption');
const urlInput = document.getElementById('url-input');
const fileInput = document.getElementById('file-input');
const fileDropArea = document.getElementById('file-drop-area');
const fileLabel = document.getElementById('file-label');
const uploadContainer = document.getElementById('upload-input-container');
const urlContainer = document.getElementById('url-input-container');
const tabs = document.querySelectorAll('.tab');

let memories = [];
let fileToUpload = null;

// Initial Render
fetchMemories();

// --- Supabase Logic ---

async function fetchMemories() {
    const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching memories:', error);
        alert('Could not load memories. Check console.');
    } else {
        memories = data;
        renderMemories();
    }
}

async function uploadImage(file) {
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
        .from('scrapbook-memories')
        .upload(fileName, file);

    if (error) {
        console.error('Upload error:', error);
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('scrapbook-memories')
        .getPublicUrl(fileName);

    return publicUrl;
}

// --- Event Listeners ---

addCard.addEventListener('click', () => {
    modal.classList.remove('hidden');
    resetForm();
});

closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// Tab Switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (tab.dataset.mode === 'upload') {
            uploadContainer.classList.remove('hidden');
            urlContainer.classList.add('hidden');
        } else {
            uploadContainer.classList.add('hidden');
            urlContainer.classList.remove('hidden');
        }
    });
});

// File Upload Logic
fileDropArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileToUpload = file;
        fileLabel.textContent = "Selected: " + file.name;
        fileLabel.style.color = "green";
        fileLabel.style.fontWeight = "bold";
    }
});

// Form Submission
memoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.querySelector('.submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Sticking...';
    submitBtn.disabled = true;

    try {
        let imageUrl = null;

        // Determine Image Source
        if (!uploadContainer.classList.contains('hidden')) {
            // Upload Mode
            if (fileToUpload) {
                imageUrl = await uploadImage(fileToUpload);
            }
        } else {
            // URL Mode
            imageUrl = urlInput.value;
        }

        if (!captionInput.value && !imageUrl) {
            throw new Error("Please add a caption or an image.");
        }

        const newMemory = {
            text: captionInput.value,
            image: imageUrl,
            rotation: Math.random() * 10 - 5
        };

        const { data, error } = await supabase
            .from('memories')
            .insert([newMemory])
            .select();

        if (error) throw error;

        // Add to local list immediately for responsiveness (or just refetch)
        memories.unshift(data[0]);
        renderMemories();
        modal.classList.add('hidden');

    } catch (err) {
        console.error(err);
        alert('Error saving memory: ' + err.message);
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
});

async function deleteMemory(id) {
    if (confirm('Rip this page out?')) {
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete error:', error);
            alert('Failed to delete.');
        } else {
            memories = memories.filter(m => m.id !== id);
            renderMemories();
        }
    }
}

function renderMemories() {
    // 1. Remove all old mem-cards (keeping the add-card)
    const existingCards = document.querySelectorAll('.mem-card');
    existingCards.forEach(c => c.remove());

    // 2. Insert new cards
    memories.forEach(memory => {
        const card = document.createElement('div');
        card.className = 'polaroid mem-card';
        card.style.transform = `rotate(${memory.rotation}deg)`;

        const imgHtml = memory.image
            ? `<img src="${memory.image}" alt="Memory">`
            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:0.8rem;">No Image</div>`;

        card.innerHTML = `
            <div class="photo-frame">
                ${imgHtml}
            </div>
            <div class="caption">${memory.text}</div>
            <button class="delete-btn" onclick="deleteMemory(${memory.id})">
                <i data-lucide="x" width="14" height="14"></i>
            </button>
        `;

        memoryGrid.appendChild(card);
    });

    lucide.createIcons();
}

function resetForm() {
    captionInput.value = '';
    urlInput.value = '';
    fileInput.value = '';
    fileToUpload = null;
    fileLabel.textContent = "Click to Upload Photo";
    fileLabel.style.color = "#666";
    fileLabel.style.fontWeight = "normal";
}
