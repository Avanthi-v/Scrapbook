// Initialize Icons
lucide.createIcons();

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

let memories = JSON.parse(localStorage.getItem('scrapbook_memories')) || [
    {
        id: Date.now(),
        text: "My New Scrapbook Project!",
        image: "https://images.unsplash.com/photo-1544376798-89aa6b82c6cd?q=80&w=1000&auto=format&fit=crop",
        rotation: -2
    }
];

let currentImage = null;

// Initial Render
renderMemories();

// Event Listeners
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
    handleFile(file);
});

function handleFile(file) {
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            currentImage = reader.result;
            fileLabel.textContent = "Image Selected: " + file.name;
            fileLabel.style.color = "green";
            fileLabel.style.fontWeight = "bold";
        };
        reader.readAsDataURL(file);
    }
}

// Form Submission
memoryForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // If URL mode is active (and input is not hidden), use that input
    if (!uploadContainer.classList.contains('hidden')) {
        // Upload mode: currentImage is already set by FileReader
    } else {
        // URL mode
        currentImage = urlInput.value;
    }

    if (!captionInput.value && !currentImage) return;

    const newMemory = {
        id: Date.now(),
        text: captionInput.value,
        image: currentImage,
        rotation: Math.random() * 10 - 5
    };

    memories.unshift(newMemory); // Add to beginning
    saveMemories();
    renderMemories();

    modal.classList.add('hidden');
});

function deleteMemory(id) {
    if (confirm('Rip this page out?')) {
        memories = memories.filter(m => m.id !== id);
        saveMemories();
        renderMemories();
    }
}

function saveMemories() {
    localStorage.setItem('scrapbook_memories', JSON.stringify(memories));
}

function renderMemories() {
    // Clear everything except base structure if needed, but easier to rebuild grid
    // Keep the "Add Card" as the first element always

    // 1. Remove all mem-cards
    const existingCards = document.querySelectorAll('.mem-card');
    existingCards.forEach(c => c.remove());

    // 2. Insert new cards after the "add-card"
    memories.forEach(memory => {
        const card = document.createElement('div');
        card.className = 'polaroid mem-card';
        card.style.transform = `rotate(${memory.rotation}deg)`;

        // Add random hover z-index interaction handled by CSS mostly, but specific rotation needs JS

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

    lucide.createIcons(); // Refresh icons for new elements
}

function resetForm() {
    captionInput.value = '';
    urlInput.value = '';
    fileInput.value = '';
    currentImage = null;
    fileLabel.textContent = "Click to Upload Photo";
    fileLabel.style.color = "#666";
}
