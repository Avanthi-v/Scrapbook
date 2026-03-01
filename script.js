// Small auth guard: if the page contains the memories grid, require a signed-in user
function _checkAuthForMemories() {
    function guard() {
        const memoryGridEl = document.getElementById('memory-grid');
        if (memoryGridEl) {
            const user = sessionStorage.getItem('scrapbook_user');
            if (!user) {
                // Not signed in — send to sign-in page
                window.location.replace('index.html');
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', guard);
    } else {
        guard();
    }
}

_checkAuthForMemories();

// Initialize Icons (Wrapped to ensure load)
document.addEventListener('DOMContentLoaded', () => {
    try {
        lucide.createIcons();
    } catch (e) {
        console.error("Lucide Error", e);
    }
    // Wire sign-out button if present
    try {
        const signoutBtn = document.getElementById('signout-btn');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', () => {
                sessionStorage.removeItem('scrapbook_user');
                // optional: clear all session storage
                // sessionStorage.clear();
                window.location.href = 'index.html';
            });
        }
    } catch (err) {
        console.error('Signout wiring failed:', err);
    }
    
    // Initialize voice recording support check
    try {
        if (!isVoiceRecordingSupported && voiceDisabledText) {
            voiceDisabledText.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Voice recording initialization failed:', err);
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

// Video Elements
const videoInput = document.getElementById('video-input');
const videoDropArea = document.getElementById('video-drop-area');
const videoLabel = document.getElementById('video-label');
const videoUploadContainer = document.getElementById('video-upload-container');
const videoUrlContainer = document.getElementById('video-url-container');
const videoUrlInput = document.getElementById('video-url-input');
const videoTabs = document.querySelectorAll('.tab-video');

// Image Modal Elements
const imageModal = document.getElementById('image-modal');
const closeImageModal = document.getElementById('close-image-modal');
const modalImage = document.getElementById('modal-image');

// Video Modal Elements
const videoModal = document.getElementById('video-modal');
const closeVideoModal = document.getElementById('close-video-modal');
const modalVideo = document.getElementById('modal-video');
const modalVideoSource = document.getElementById('modal-video-source');

// Notepad Elements
const notepadIcon = document.getElementById('notepad-icon');
const notepadSidebar = document.getElementById('notepad-sidebar');
const closeNotepad = document.getElementById('close-notepad');
const notesList = document.getElementById('notes-list');
const newNoteInput = document.getElementById('new-note-input');
const saveNotesBtn = document.getElementById('save-notes-btn');
const recordVoiceBtn = document.getElementById('record-voice-btn');
const voiceRecordingIndicator = document.getElementById('voice-recording-indicator');
const recordingTime = document.getElementById('recording-time');
const voicePlaybackArea = document.getElementById('voice-playback-area');
const voicePlayback = document.getElementById('voice-playback');
const useVoiceBtn = document.getElementById('use-voice-btn');
const discardVoiceBtn = document.getElementById('discard-voice-btn');
const voiceDisabledText = document.getElementById('voice-disabled-text');

let memories = [];
let fileToUpload = null;
let videoFileToUpload = null;
let notes = [];
let notepadOpen = false;

// Voice Recording Variables
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingInterval = null;
let recordedBlob = null;
const isVoiceRecordingSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Initial Render — only run on the memories page where the grid exists
if (memoryGrid) {
    fetchMemories();
    fetchNotes();
}

// --- Notes Functions ---
async function fetchNotes() {
    const { data, error } = await supabaseClient
        .from('notes')
        .select('*')
        .or('notes_removed.is.null,notes_removed.eq.false')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notes:', error);
    } else {
        notes = data || [];
        displayNotes();
    }
}

function displayNotes() {
    const notesList = document.getElementById('notes-list');
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div style="text-align: center; color: #999; padding: 2rem 1rem;">No notes yet. Add one to get started!</div>';
        return;
    }
    
    notesList.innerHTML = '';
    
    notes.forEach((note, index) => {
        const noteEntry = document.createElement('div');
        noteEntry.className = 'note-entry';
        noteEntry.setAttribute('data-note-id', note.id);
        noteEntry.setAttribute('data-note-index', index);
        
        const noteDate = new Date(note.created_at).toLocaleDateString();
        const noteText = `[${noteDate}] ${note.note_message}`;
        
        let voiceHtml = '';
        if (note.voice_url) {
            voiceHtml = `<audio controls style="width: 100%; margin-top: 0.5rem; margin-bottom: 0.5rem;"><source src="${note.voice_url}" type="audio/webm">Your browser does not support audio playback.</audio>`;
        }
        
        noteEntry.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <div style="flex: 1;">${noteText}</div>
                <button class="note-delete-btn" title="Delete note">×</button>
            </div>
            ${voiceHtml}
        `;
        
        const deleteBtn = noteEntry.querySelector('.note-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(note.id, index);
        });
        
        notesList.appendChild(noteEntry);
    });
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
            .insert([{ note_message: noteText, notes_removed: false }])
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

async function deleteNote(noteId, index) {
    try {
        const { error } = await supabaseClient
            .from('notes')
            .update({ notes_removed: true })
            .eq('id', noteId);

        if (error) {
            console.error("Failed to delete note:", error);
            alert(`Failed to delete note: ${error.message}`);
            return;
        }

        notes.splice(index, 1);
        displayNotes();
    } catch (err) {
        console.error("Error deleting note:", err);
    }
}

// --- Supabase Logic ---

async function fetchMemories() {
    try {
        console.log('Debug: supabaseClient exists?', !!supabaseClient, supabaseClient ? { url: SUPABASE_URL } : null);
        const { data, error, status, statusText } = await supabaseClient
            .from('memories')
            .select('*')
            .order('created_at', { ascending: false });

        console.log('fetchMemories result:', { status, statusText, error, data });

        if (error) {
            console.error('Error fetching memories:', error);
            // Show popup alert like previous behavior
            alert('Could not load memories. Check console.');
            return;
        }

        memories = data || [];
        // If there are no memories, render the empty state via renderMemories()
        if (!memories.length) {
            renderMemories();
            return;
        }
        renderMemories();
    } catch (err) {
        console.error('Unexpected error fetching memories:', err);
        alert('Unexpected error loading memories. See console.');
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

async function uploadVideo(file) {
    const fileName = `video-${Date.now()}-${file.name}`;
    const { data, error } = await supabaseClient.storage
        .from('scrapbook-memories')
        .upload(fileName, file);

    if (error) {
        console.error('Video upload error:', error);
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

// Video Modal Events
closeVideoModal.addEventListener('click', () => {
    videoModal.classList.add('hidden');
    modalVideo.pause();
});

videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) {
        videoModal.classList.add('hidden');
        modalVideo.pause();
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
        newNoteInput.focus();
    }
});

closeNotepad.addEventListener('click', () => {
    notepadSidebar.classList.add('hidden');
    notepadOpen = false;
});

saveNotesBtn.addEventListener('click', saveNotes);

// Allow Enter key to save note
newNoteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveNotes();
    }
});

// Voice Recording Functions
async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordedBlob = null;

        mediaRecorder.addEventListener('dataavailable', (event) => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', () => {
            recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(recordedBlob);
            voicePlayback.src = audioUrl;
            
            // Show playback area, hide recording indicator
            voiceRecordingIndicator.classList.add('hidden');
            voicePlaybackArea.classList.remove('hidden');
            recordVoiceBtn.textContent = '';
            recordVoiceBtn.innerHTML = '<i data-lucide="mic"></i>';
            lucide.createIcons();
        });

        mediaRecorder.start();
        voiceRecordingIndicator.classList.remove('hidden');
        voicePlaybackArea.classList.add('hidden');
        recordVoiceBtn.textContent = '';
        recordVoiceBtn.innerHTML = '<i data-lucide="square"></i>';
        lucide.createIcons();

        recordingStartTime = Date.now();
        recordingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            recordingTime.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 100);
    } catch (err) {
        console.error('Microphone access denied:', err);
        if (!isVoiceRecordingSupported) {
            voiceDisabledText.classList.remove('hidden');
        }
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        clearInterval(recordingInterval);
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

async function saveVoiceNote() {
    if (!recordedBlob) {
        alert('No voice recording to save!');
        return;
    }

    try {
        const fileName = `voice-${Date.now()}.webm`;
        const { data, error } = await supabaseClient.storage
            .from('scrapbook-memories')
            .upload(fileName, recordedBlob);

        if (error) {
            console.error('Voice upload error:', error);
            alert(`Voice upload failed: ${error.message}`);
            return;
        }

        const { data: { publicUrl } } = supabaseClient.storage
            .from('scrapbook-memories')
            .getPublicUrl(fileName);

        // Save as a note with voice URL
        newNoteInput.value = `[Voice Note: ${new Date().toLocaleTimeString()}]`;
        
        const { data: insertData, error: insertError } = await supabaseClient
            .from('notes')
            .insert([{ note_message: newNoteInput.value, notes_removed: false, voice_url: publicUrl }])
            .select();

        if (insertError) {
            console.error("Database Save Failed:", insertError);
            alert(`Failed to save voice note: ${insertError.message}`);
            return;
        }

        notes.unshift(insertData[0]);
        displayNotes();
        
        // Reset voice recording UI
        newNoteInput.value = '';
        voicePlayback.src = '';
        recordedBlob = null;
        voicePlaybackArea.classList.add('hidden');
        voiceRecordingIndicator.classList.add('hidden');
        recordVoiceBtn.textContent = '';
        recordVoiceBtn.innerHTML = '<i data-lucide="mic"></i>';
        lucide.createIcons();

        useVoiceBtn.textContent = 'Voice Saved!';
        setTimeout(() => {
            useVoiceBtn.textContent = 'Use Voice Note';
        }, 1500);
    } catch (err) {
        console.error("Error saving voice note:", err);
        alert(`Error: ${err.message}`);
    }
}

function discardVoiceRecording() {
    recordedBlob = null;
    voicePlayback.src = '';
    voicePlaybackArea.classList.add('hidden');
    voiceRecordingIndicator.classList.add('hidden');
    recordVoiceBtn.textContent = '';
    recordVoiceBtn.innerHTML = '<i data-lucide="mic"></i>';
    lucide.createIcons();
}

// Voice Recording Event Listeners
recordVoiceBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isVoiceRecordingSupported) {
        voiceDisabledText.classList.remove('hidden');
        return;
    }

    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
});

useVoiceBtn.addEventListener('click', (e) => {
    e.preventDefault();
    saveVoiceNote();
});

discardVoiceBtn.addEventListener('click', (e) => {
    e.preventDefault();
    discardVoiceRecording();
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

// Video Tab Switching
videoTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        videoTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (tab.dataset.mode === 'video-upload') {
            videoUploadContainer.classList.remove('hidden');
            videoUrlContainer.classList.add('hidden');
        } else {
            videoUploadContainer.classList.add('hidden');
            videoUrlContainer.classList.remove('hidden');
        }
    });
});

// Media Type Selector (None, Image, Video)
const mediaTabs = document.querySelectorAll('.tab-media');
const imageSection = document.getElementById('image-section');
const videoSection = document.getElementById('video-section');
let selectedMediaType = 'none';

mediaTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        mediaTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedMediaType = tab.dataset.mode;

        if (tab.dataset.mode === 'image') {
            imageSection.classList.remove('hidden');
            videoSection.classList.add('hidden');
            fileToUpload = null;
            fileLabel.textContent = "Click to Upload Photo";
            fileLabel.style.color = "#666";
        } else if (tab.dataset.mode === 'video') {
            imageSection.classList.add('hidden');
            videoSection.classList.remove('hidden');
            videoFileToUpload = null;
            videoLabel.textContent = "Click to Upload Video";
            videoLabel.style.color = "#666";
        } else {
            imageSection.classList.add('hidden');
            videoSection.classList.add('hidden');
            fileToUpload = null;
            videoFileToUpload = null;
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

// Video Upload Logic
videoDropArea.addEventListener('click', () => videoInput.click());

videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        videoFileToUpload = file;
        videoLabel.textContent = "Selected: " + file.name;
        videoLabel.style.color = "green";
        videoLabel.style.fontWeight = "bold";
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
        let videoUrl = null;

        // Media Upload Phase - only one media type at a time
        if (selectedMediaType === 'image') {
            if (!uploadContainer.classList.contains('hidden') && fileToUpload) {
                try {
                    imageUrl = await uploadImage(fileToUpload);
                } catch (uploadErr) {
                    console.error("Upload Failed:", uploadErr);
                    alert(`Image Upload Failed: ${uploadErr.message}. \n\nCheck if your Storage Bucket policy allows uploads or if the bucket exists.`);
                    throw new Error("Aggregated Upload Error");
                }
            } else if (urlContainer && !uploadContainer.classList.contains('hidden') === false) {
                imageUrl = urlInput.value;
            }
        } else if (selectedMediaType === 'video') {
            if (!videoUploadContainer.classList.contains('hidden') && videoFileToUpload) {
                try {
                    videoUrl = await uploadVideo(videoFileToUpload);
                } catch (uploadErr) {
                    console.error("Video Upload Failed:", uploadErr);
                    alert(`Video Upload Failed: ${uploadErr.message}. \n\nCheck if your Storage Bucket policy allows uploads or if the bucket exists.`);
                    throw new Error("Aggregated Video Upload Error");
                }
            } else if (videoUrlContainer && !videoUploadContainer.classList.contains('hidden') === false) {
                videoUrl = videoUrlInput.value;
            }
        }

        if (!captionInput.value && !imageUrl && !videoUrl) {
            alert("Please provide text or media!");
            return;
        }

        // Database Insert Phase
        const newMemory = {
            text: captionInput.value,
            image: imageUrl,
            video: videoUrl,
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
        if (err.message !== "Aggregated Upload Error" && err.message !== "Aggregated Video Upload Error") {
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

        let mediaHtml = '';
        if (memory.image) {
            mediaHtml = `<img src="${memory.image}" alt="Memory" class="memory-img" data-image="${memory.image}">`;
        } else if (memory.video) {
            mediaHtml = `<video width="100%" height="100%" style="object-fit: cover;" class="memory-video" data-video="${memory.video}"><source src="${memory.video}" type="video/mp4"><source src="${memory.video}" type="video/webm">Your browser does not support video playback.</video>`;
        } else {
            mediaHtml = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:0.8rem;">No Media</div>`;
        }

        const dateHtml = memory.memory_date 
            ? `<div class="memory-date">${new Date(memory.memory_date).toLocaleDateString()} -</div>`
            : '';

        card.innerHTML = `
            <div class="photo-frame">
                ${mediaHtml}
            </div>
            <div class="memory-content">
                ${dateHtml}
                <div class="caption">${memory.text}</div>
            </div>
        `;

        memoryGrid.appendChild(card);

        // Add click event to images and videos for modal view
        if (memory.image) {
            const img = card.querySelector('.memory-img');
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                modalImage.src = memory.image;
                imageModal.classList.remove('hidden');
            });
        }

        if (memory.video) {
            const video = card.querySelector('.memory-video');
            video.addEventListener('click', (e) => {
                e.stopPropagation();
                modalVideoSource.src = memory.video;
                modalVideo.load();
                videoModal.classList.remove('hidden');
                modalVideo.play();
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
    
    // Reset video fields
    videoUrlInput.value = '';
    videoInput.value = '';
    videoFileToUpload = null;
    videoLabel.textContent = "Click to Upload Video";
    videoLabel.style.color = "#666";
    videoLabel.style.fontWeight = "normal";
    
    // Reset media type selector
    selectedMediaType = 'none';
    mediaTabs.forEach(t => t.classList.remove('active'));
    mediaTabs[0].classList.add('active'); // "None" tab
    imageSection.classList.add('hidden');
    videoSection.classList.add('hidden');
}
