let isAdmin = false;

async function _checkAuthForMemories() {
    const memoryGridEl = document.getElementById('memory-grid');
    if (!memoryGridEl) return;

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
        console.error('Auth session lookup failed:', error);
    }

    if (!data?.session) {
        window.location.replace('index.html');
    }
}

_checkAuthForMemories();

function currentUserIsAdmin() {
    return isAdmin;
}

async function fetchAdminStatus() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
        console.error('Supabase auth session error:', error);
        return false;
    }

    const user = data?.session?.user;
    if (!user) return false;

    const knownAdminEmails = new Set(['ghost@example.com']);
    if (knownAdminEmails.has(user.email)) {
        return true;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.warn('Could not load admin profile:', profileError.message);
        return false;
    }

    return profile?.is_admin === true;
}

async function initPage() {
    await _checkAuthForMemories();
    isAdmin = await fetchAdminStatus();
    fetchMemories();
    fetchNotes();

    // Start realtime subscription to keep the UI in sync across users
    try {
        subscribeToMemories();
    } catch (e) {
        console.warn('Could not start realtime subscription for memories:', e);
    }
}

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
            signoutBtn.addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                sessionStorage.clear();
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
    initPage();
}

// --- Notes Functions ---
async function fetchNotes() {
    const { data, error } = await supabaseClient
        .from('notes')
        .select('*')
        .not('notes_removed', 'eq', true)
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
        const canDeleteNotes = currentUserIsAdmin();
        const deleteButtonHtml = canDeleteNotes ? '<button class="note-delete-btn" title="Delete note">×</button>' : '';
        
        let voiceHtml = '';
        if (note.voice_url) {
            voiceHtml = `<audio controls style="width: 100%; margin-top: 0.5rem; margin-bottom: 0.5rem;"><source src="${note.voice_url}" type="audio/webm">Your browser does not support audio playback.</audio>`;
        }
        
        noteEntry.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <div style="flex: 1;">${noteText}</div>
                ${deleteButtonHtml}
            </div>
            ${voiceHtml}
        `;
        
        if (canDeleteNotes) {
            const deleteBtn = noteEntry.querySelector('.note-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(note.id, index);
            });
        }
        
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
// Auto-expand textarea as user types
function autoExpandTextarea(textarea) {
    textarea.style.height = 'auto';
    const maxHeight = textarea.id === 'new-note-input' ? 70 : 400;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
}

// Attach textarea auto-expand listener
if (captionInput) {
    captionInput.addEventListener('input', function() {
        autoExpandTextarea(this);
    });
}

// Attach auto-expand to notepad textarea
if (newNoteInput) {
    newNoteInput.addEventListener('input', function() {
        autoExpandTextarea(this);
    });
}
async function deleteNote(noteId, index) {
    if (!currentUserIsAdmin()) {
        alert('Delete permission only available for authorized users.');
        return;
    }

    try {
        console.log('deleteNote called for', { noteId, index, isAdmin: currentUserIsAdmin() });

        // Diagnostic: fetch the row before attempting update to verify it exists
        try {
            const { data: beforeData, error: beforeError } = await supabaseClient
                .from('notes')
                .select('id, notes_removed')
                .eq('id', noteId);
            console.log('Pre-update select for note:', { beforeData, beforeError });
        } catch (preErr) {
            console.error('Pre-update select failed:', preErr);
        }

        const { data, error } = await supabaseClient
            .from('notes')
            .update({ notes_removed: true })
            .eq('id', noteId)
            .select();

        console.log('deleteNote result:', { noteId, data, error });

        if (error) {
            console.error("Failed to delete note:", error);
            alert(`Failed to delete note: ${error.message}`);
            return;
        }

        // Handle different response shapes: some Supabase configs return
        // an array, others an object, and RLS may cause `data` to be null.
        if (!data) {
            console.warn('No updated row returned after note update; attempting explicit SELECT to verify current row state.');
            try {
                const { data: selectData, error: selectError } = await supabaseClient
                    .from('notes')
                    .select('id, notes_removed')
                    .eq('id', noteId);

                console.log('Post-update select check:', { selectData, selectError });

                if (selectError) {
                    console.error('Select after update failed:', selectError);
                } else if (selectData && selectData.length > 0) {
                    console.log('Row after attempted update:', selectData[0]);
                    if (selectData[0].notes_removed) {
                        // The row was updated but update response omitted data (likely RLS). Remove locally.
                        notes.splice(index, 1);
                        displayNotes();
                        return;
                    }
                }
            } catch (selErr) {
                console.error('Error during post-update select check:', selErr);
            }

            console.warn('Falling back to refetching notes to sync UI. Check Supabase RLS/Row-Level policies if this repeats.');
            await fetchNotes();
            return;
        }

        let updatedRow = null;
        if (Array.isArray(data)) {
            if (data.length === 0) {
                console.warn('Update returned empty array; attempting explicit SELECT to inspect row state.');
                try {
                    const { data: selectData, error: selectError } = await supabaseClient
                        .from('notes')
                        .select('id, notes_removed')
                        .eq('id', noteId);
                    console.log('Explicit select after empty update response:', { selectData, selectError });

                    if (selectError) {
                        console.error('Select after empty update response failed:', selectError);
                    } else if (selectData && selectData.length > 0 && selectData[0].notes_removed) {
                        notes.splice(index, 1);
                        displayNotes();
                        return;
                    }
                } catch (selErr) {
                    console.error('Error during explicit select after empty update response:', selErr);
                }

                console.warn('Falling back to refetching notes after empty update response.');
                await fetchNotes();
                return;
            }
            if (data.length > 1) {
                console.warn('Update returned multiple rows for id', noteId, data);
            }
            updatedRow = data[0];
        } else if (typeof data === 'object') {
            updatedRow = data;
        }

        if (!updatedRow) {
            console.warn('Could not determine updated row shape; refetching notes as fallback.');
            await fetchNotes();
            return;
        }

        notes.splice(index, 1);
        displayNotes();
    } catch (err) {
        console.error("Error deleting note:", err);
        alert(`Error deleting note: ${err.message}`);
    }
}

async function deleteMemory(memoryId) {
    if (!currentUserIsAdmin()) {
        alert('Delete permission only available for authorized users.');
        return;
    }

    try {
        console.log('deleteMemory called for', memoryId);

        // Pre-delete check
        try {
            const { data: beforeData, error: beforeError } = await supabaseClient
                .from('memories')
                .select('id')
                .eq('id', memoryId);
            console.log('Pre-delete select for memory:', { beforeData, beforeError });
        } catch (preErr) {
            console.error('Pre-delete select failed:', preErr);
        }

        // Attempt delete
        const { data: deleteData, error: deleteError } = await supabaseClient
            .from('memories')
            .delete()
            .eq('id', memoryId)
            .select();

        console.log('deleteMemory result:', { memoryId, deleteData, deleteError });

        if (deleteError) {
            console.error('Failed to delete memory:', deleteError);
            alert(`Failed to delete memory: ${deleteError.message}`);
            return;
        }

        // If deleteData is empty (RLS may block returning rows), verify by explicit select
        if (!deleteData || (Array.isArray(deleteData) && deleteData.length === 0)) {
            console.warn('Delete returned empty result; attempting explicit SELECT to verify deletion.');
            try {
                const { data: selectData, error: selectError } = await supabaseClient
                    .from('memories')
                    .select('id')
                    .eq('id', memoryId);
                console.log('Post-delete select check:', { selectData, selectError });
                if (selectError) {
                    console.error('Select after delete failed:', selectError);
                }
                // If the select shows no rows, the delete succeeded
                if (!selectData || selectData.length === 0) {
                    memories = memories.filter((memory) => memory.id !== memoryId);
                    renderMemories();
                    return;
                }
            } catch (selErr) {
                console.error('Error during post-delete select check:', selErr);
            }

            // If we reach here, deletion did not complete; refetch full list
            console.warn('Deletion did not remove row; refetching memories to sync UI.');
            await fetchMemories();
            return;
        }

        // If deleteData contains the deleted row(s), remove locally
        memories = memories.filter((memory) => memory.id !== memoryId);
        renderMemories();
    } catch (err) {
        console.error('Error deleting memory:', err);
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

// Realtime subscription: listens for INSERT/UPDATE/DELETE on the `memories` table
function subscribeToMemories() {
    if (!supabaseClient || typeof supabaseClient.channel !== 'function') {
        console.warn('Realtime not available on this Supabase client.');
        return;
    }

    const ch = supabaseClient
        .channel('public:memories')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, (payload) => {
            console.log('Realtime (memories) event:', payload);

            const ev = payload.eventType || payload.event;

            // Normalize new/old record across payload shapes
            const newRec = payload.new ?? payload.record ?? payload.payload?.new;
            const oldRec = payload.old ?? payload.old_record ?? payload.payload?.old;

            if (ev === 'DELETE' || ev === 'delete') {
                const id = oldRec?.id || (newRec && newRec.id);
                if (!id) return;
                memories = memories.filter(m => m.id !== id);
                renderMemories();
            } else if (ev === 'INSERT' || ev === 'insert') {
                if (!newRec) return;
                // prepend new memory
                memories = [newRec, ...(memories || [])];
                renderMemories();
            } else if (ev === 'UPDATE' || ev === 'update') {
                if (!newRec) return;
                const idx = (memories || []).findIndex(m => m.id === newRec.id);
                if (idx !== -1) {
                    memories[idx] = newRec;
                } else {
                    memories.unshift(newRec);
                }
                renderMemories();
            }
        })
        .subscribe();

    console.log('Subscribed to memories realtime channel:', ch);
    return ch;
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

// Allow Ctrl+Enter to save note
newNoteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        saveNotes();
    }
});

// Voice Recording Functions
async function startVoiceRecording() {
    try {
        let stream = null;
        
        // Try to get audio stream with multiple constraint options
        const audioConstraints = [
            { audio: true },  // Default constraints
            { audio: { echoCancellation: false } },  // Disable echo cancellation if default fails
            { audio: { echoCancellation: false, noiseSuppression: false } },  // Disable noise suppression
            { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }  // Disable all audio processing
        ];
        
        for (const constraints of audioConstraints) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('Audio access granted with constraints:', constraints);
                break;  // Success, exit the loop
            } catch (err) {
                console.warn('Failed with constraints:', constraints, err);
                // Continue to next constraint option
            }
        }
        
        if (!stream) {
            throw new Error('Unable to access microphone with any available constraints. Please check your device permissions and try a different audio input device.');
        }
        
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
        const canDeleteMemories = currentUserIsAdmin();
        const memoryDeleteHtml = canDeleteMemories ? '<button class="memory-delete-btn" title="Delete memory" style="position:absolute; top:0.75rem; right:0.75rem; border:none; background:rgba(255,255,255,0.9); border-radius:50%; width:2rem; height:2rem; font-size:1rem; cursor:pointer;">×</button>' : '';

        card.innerHTML = `
            <div class="photo-frame">
                ${mediaHtml}
            </div>
            <div class="memory-content">
                ${dateHtml}
                <div class="caption">${memory.text}</div>
            </div>
            ${memoryDeleteHtml}
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

        if (canDeleteMemories) {
            const deleteBtn = card.querySelector('.memory-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteMemory(memory.id);
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
    
    // Initialize textarea height to show 3 lines
    if (captionInput) {
        captionInput.style.height = 'auto';
        captionInput.focus();
    }
}
