// Initialize Icons (Wrapped to ensure load)
document.addEventListener('DOMContentLoaded', () => {
    try {
        lucide.createIcons();
    } catch (e) {
        console.error("Lucide Error", e);
    }
});

// Supabase Configuration
const SUPABASE_URL = 'https://axmllmliekjkgtxvglnx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VF2mhtEhcH-ylutp2fdJQw_NL-Uu-oK';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const memoryGrid = document.getElementById('memory-grid');
const addCard = document.getElementById('add-card');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('close-modal');
const memoryForm = document.getElementById('memory-form');
const captionInput = document.getElementById('caption');
const memoryDateInput = document.getElementById('memory-date');
const urlInput = document.getElementById('url-input');
const fileInput = document.getElementById('file-input');
const fileDropArea = document.getElementById('file-drop-area');
const fileLabel = document.getElementById('file-label');
const uploadContainer = document.getElementById('upload-input-container');
const urlContainer = document.getElementById('url-input-container');
const tabs = document.querySelectorAll('.tab');

// Image Modal Elements
const imageModal = document.getElementById('image-modal');
const closeImageModal = document.getElementById('close-image-modal');
const modalImage = document.getElementById('modal-image');

// Notepad Elements
const notepadIcon = document.getElementById('notepad-icon');
const notepadSidebar = document.getElementById('notepad-sidebar');
const closeNotepad = document.getElementById('close-notepad');
const notepadText = document.getElementById('notepad-text');
const newNoteInput = document.getElementById('new-note-input');
const saveNotesBtn = document.getElementById('save-notes-btn');

let memories = [];
let fileToUpload = null;
let notes = [];
let notepadOpen = false;

// Initial Render
fetchMemories();
fetchNotes();

// --- Notes Functions ---
async function fetchNotes() {
    const { data, error } = await supabaseClient
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notes:', error);
    } else {
        notes = data || [];
        displayNotes();
    }
}

function displayNotes() {
    notepadText.value = notes.map(note => `[${new Date(note.created_at).toLocaleDateString()}] ${note.note_message}`).join('\n\n');
}

async function saveNotes() {
    const noteText = newNoteInput.value.trim();
    if (!noteText) {
        alert("Please write something!");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('notes')
            .insert([{ note_message: noteText }])
            .select();

        if (error) {
            console.error("Database Save Failed:", error);
            alert(`Failed to save note: ${error.message}`);
            return;
        }

        notes.unshift(data[0]);
        displayNotes();
        newNoteInput.value = '';
        saveNotesBtn.textContent = 'Added!';
        setTimeout(() => {
            saveNotesBtn.textContent = 'Add Note';
        }, 1500);
    } catch (err) {
        console.error("Error saving note:", err);
    }
}

// --- Supabase Logic ---

async function fetchMemories() {
    const { data, error } = await supabaseClient
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
    const { data, error } = await supabaseClient.storage
        .from('scrapbook-memories')
        .upload(fileName, file);

    if (error) {
        console.error('Upload error:', error);
        throw error;
    }

    const { data: { publicUrl } } = supabaseClient.storage
        .from('scrapbook-memories')
        .getPublicUrl(fileName);

    return publicUrl;
}

// --- Event Listeners ---

addCard.addEventListener('click', () => {
    console.log("Add Card Clicked");
    try {
        modal.classList.remove('hidden');
        resetForm();
    } catch (e) {
        console.error("Error opening modal:", e);
        alert("Something went wrong opening the form: " + e.message);
    }
});

closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// Image Modal Events
closeImageModal.addEventListener('click', () => {
    imageModal.classList.add('hidden');
});

imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        imageModal.classList.add('hidden');
    }
});

// Notepad Events
notepadIcon.addEventListener('click', () => {
    if (notepadOpen) {
        notepadSidebar.classList.add('hidden');
        notepadOpen = false;
    } else {
        notepadSidebar.classList.remove('hidden');
        notepadOpen = true;
    }
});

closeNotepad.addEventListener('click', () => {
    notepadSidebar.classList.add('hidden');
    notepadOpen = false;
});

saveNotesBtn.addEventListener('click', saveNotes);

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

        // 1. Image Upload Phase
        if (!uploadContainer.classList.contains('hidden') && fileToUpload) {
            try {
                imageUrl = await uploadImage(fileToUpload);
            } catch (uploadErr) {
                console.error("Upload Failed:", uploadErr);
                alert(`Image Upload Failed: ${uploadErr.message}. \n\nCheck if your Storage Bucket policy allows uploads or if the bucket exists.`);
                throw new Error("Aggregated Upload Error"); // Stop execution
            }
        } else if (urlContainer && !uploadContainer.classList.contains('hidden') === false) {
            imageUrl = urlInput.value;
        }

        if (!captionInput.value && !imageUrl) {
            alert("Please provide text or an image!");
            return;
        }

        // 2. Database Insert Phase
        const newMemory = {
            text: captionInput.value,
            image: imageUrl,
            memory_date: memoryDateInput.value || null,
            rotation: Math.random() * 10 - 5
        };

        const { data, error } = await supabaseClient
            .from('memories')
            .insert([newMemory])
            .select();

        if (error) {
            console.error("Database Insert Failed:", error);
            alert(`Database Save Failed: ${error.message}. \n\nCheck if your Table 'memories' exists and if RLS is disabled (or allows 'anon' inserts).`);
            throw error;
        }

        // Success
        memories.unshift(data[0]);
        renderMemories();
        modal.classList.add('hidden');

    } catch (err) {
        if (err.message !== "Aggregated Upload Error") {
            // General catch
        }
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
});

// function deleteMemory(id) removed per user request

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
            ? `<img src="${memory.image}" alt="Memory" class="memory-img" data-image="${memory.image}">`
            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:0.8rem;">No Image</div>`;

        const dateHtml = memory.memory_date 
            ? `<div class="memory-date">${new Date(memory.memory_date).toLocaleDateString()} -</div>`
            : '';

        card.innerHTML = `
            <div class="photo-frame">
                ${imgHtml}
            </div>
            <div class="memory-content">
                ${dateHtml}
                <div class="caption">${memory.text}</div>
            </div>
        `;

        memoryGrid.appendChild(card);

        // Add click event to images for modal view
        if (memory.image) {
            const img = card.querySelector('.memory-img');
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                modalImage.src = memory.image;
                imageModal.classList.remove('hidden');
            });
        }
    });

    lucide.createIcons();
}

function resetForm() {
    captionInput.value = '';
    memoryDateInput.value = '';
    urlInput.value = '';
    fileInput.value = '';
    fileToUpload = null;
    fileLabel.textContent = "Click to Upload Photo";
    fileLabel.style.color = "#666";
    fileLabel.style.fontWeight = "normal";
}
