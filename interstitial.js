
const params = new URLSearchParams(window.location.search);
const targetUrl = params.get('target');
const targetSiteEl = document.getElementById('target-site');
const profilesGrid = document.getElementById('profiles-grid');
const skipBtn = document.getElementById('skip-btn');
const mainDontShow = document.getElementById('main-dont-show');

// Modal Elements
const modal = document.getElementById('profile-modal');
const modalTitle = document.getElementById('modal-title');
const nameInput = document.getElementById('modal-name-input');
const containerSelect = document.getElementById('modal-container-select');
const saveBtn = document.getElementById('modal-save-btn');
const cancelBtn = document.getElementById('modal-cancel-btn');
const deleteBtn = document.getElementById('modal-delete-btn');
const createContainerBtn = document.getElementById('create-container-inline-btn');

const modalEmojiGrid = document.getElementById('modal-emoji-grid');
const modalIconVal = document.getElementById('modal-icon-val');

// Container Modal Elements
const cModal = document.getElementById('container-modal');
const cName = document.getElementById('c-name');
const cSave = document.getElementById('c-save');
const cCancel = document.getElementById('c-cancel');
const cColorGrid = document.getElementById('c-color-grid');
const cIconGrid = document.getElementById('c-icon-grid');
const cColorVal = document.getElementById('c-color-val');
const cIconVal = document.getElementById('c-icon-val');

let currentHostname = null;
try {
    if (targetUrl) {
        const u = new URL(targetUrl);
        currentHostname = u.hostname;
    }
} catch (e) {
    if (targetSiteEl) targetSiteEl.textContent = "Invalid URL";
}

let storedData = { profiles: [], settings: {} };
let editingProfileId = null;
let currentLang = 'en'; // Hardcoded En

// Initial Load
async function init() {
    try {
        const keys = ['globalSettings'];
        if (currentHostname) keys.push(currentHostname);

        const stored = await browser.storage.local.get(keys);

        // Default to English
        currentLang = 'en';

        // Apply to static elements immediately
        applyLanguage(currentLang);

        if (currentHostname && stored[currentHostname]) {
            storedData = stored[currentHostname];
            if (!storedData.profiles) storedData.profiles = [];
            if (!storedData.settings) storedData.settings = {};
        }
    } catch (e) {
        console.error("Failed to load storage", e);
    }

    renderGrid();

    // Check mode
    if (params.get('mode') === 'add') {
        openModal();
    }
}

function applyLanguage(lang) {
    if (typeof getTranslation !== 'function') return;

    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const trans = getTranslation(key, lang);
        if (trans) el.textContent = trans;
    });

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const trans = getTranslation(key, lang);
        if (trans) el.title = trans;
    });

    // Manual Update for Dynamic Elements
    if (targetSiteEl) {
        const label = getTranslation('target', lang);
        targetSiteEl.textContent = currentHostname ? `${label}: ${currentHostname}` : label;
    }
}

function renderGrid() {
    if (!profilesGrid) return;
    profilesGrid.innerHTML = '';

    // 1. Render User Profiles
    storedData.profiles.forEach(profile => {
        const card = createProfileCard(profile);
        profilesGrid.appendChild(card);
    });

    // 2. Render Guest Profile
    const guestCard = document.createElement('div');
    guestCard.className = 'profile-card guest';

    const guestIcon = document.createElement('div');
    guestIcon.className = 'profile-icon guest';
    const guestEmoji = document.createElement('span');
    guestEmoji.style.fontSize = '2rem';
    guestEmoji.textContent = '👻';
    guestIcon.appendChild(guestEmoji);

    const guestName = document.createElement('div');
    guestName.className = 'profile-name';
    guestName.setAttribute('data-i18n', 'guest');
    guestName.textContent = 'Guest';

    const infoIcon = document.createElement('div');
    infoIcon.className = 'info-icon';
    infoIcon.setAttribute('data-i18n-title', 'guestTooltip');
    infoIcon.title = 'Temporary container. Deleted when tab is closed.';
    infoIcon.textContent = 'i';

    guestCard.appendChild(guestIcon);
    guestCard.appendChild(guestName);
    guestCard.appendChild(infoIcon);
    guestCard.onclick = openGuest;
    profilesGrid.appendChild(guestCard);

    // 3. Render Add Profile
    const addCard = document.createElement('div');
    addCard.className = 'profile-card add-profile';

    const addIcon = document.createElement('div');
    addIcon.className = 'profile-icon';
    const addSpan = document.createElement('span');
    addSpan.textContent = '+';
    addIcon.appendChild(addSpan);

    const addName = document.createElement('div');
    addName.className = 'profile-name';
    addName.setAttribute('data-i18n', 'addProfile');
    addName.textContent = 'Add Profile';

    addCard.appendChild(addIcon);
    addCard.appendChild(addName);
    addCard.onclick = () => openModal();
    profilesGrid.appendChild(addCard);

    applyLanguage(currentLang);
}

function createProfileCard(profile) {
    const div = document.createElement('div');
    div.className = 'profile-card';

    // Determine icon (emoji or first letter)
    let iconContent = profile.icon || profile.name.charAt(0).toUpperCase();

    const iconDiv = document.createElement('div');
    iconDiv.className = 'profile-icon';
    iconDiv.style.backgroundColor = profile.color || '#333';

    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '2.5rem';
    iconSpan.style.color = 'white';
    iconSpan.textContent = iconContent;

    const editBtn = document.createElement('div');
    editBtn.className = 'edit-btn';
    editBtn.title = 'Edit Profile';
    editBtn.textContent = '✏️';

    iconDiv.appendChild(iconSpan);
    iconDiv.appendChild(editBtn);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'profile-name';
    nameDiv.textContent = profile.name;

    div.appendChild(iconDiv);
    div.appendChild(nameDiv);

    // Click on card -> Open
    div.addEventListener('click', (e) => {
        // If clicked on edit button
        if (e.target.classList.contains('edit-btn')) {
            e.stopPropagation();
            openModal(profile);
        } else {
            openProfile(profile);
        }
    });

    return div;
}

// Actions

async function openGuest() {
    try {
        const container = await browser.runtime.sendMessage({ type: 'CREATE_GUEST' });
        if (container) {
            openUrlInContainer(container.cookieStoreId, true);
        }
    } catch (e) {
        console.error("Guest creation failed", e);
    }
}

function openProfile(profile) {
    openUrlInContainer(profile.cookieStoreId, false, profile.id);
}

function openUrlInContainer(cookieStoreId, isGuest = false, profileId = null) {
    // Check main checkbox
    const savePref = mainDontShow ? mainDontShow.checked : false;

    browser.runtime.sendMessage({
        type: 'OPEN_URL',
        url: targetUrl,
        cookieStoreId: cookieStoreId,
        hostname: currentHostname,
        isGuest: isGuest,
        profileId: profileId,
        savePreference: savePref
    });
}

// Modal Logic
async function openModal(profile = null) {
    editingProfileId = profile ? profile.id : null;
    modalTitle.textContent = profile ? "Edit Profile" : "Add Profile";

    if (!profile) modalTitle.setAttribute('data-i18n', 'addProfile');
    else modalTitle.removeAttribute('data-i18n');

    nameInput.value = profile ? profile.name : "";
    modalIconVal.value = profile ? profile.icon : "";

    deleteBtn.classList.toggle('hidden', !profile);

    // Load emojis
    const emojis = ['😀', '😎', '🤖', '👻', '🚀', '💻', '🍕', '🐱', '🐶', '🌳', ''];
    modalEmojiGrid.innerHTML = '';
    emojis.forEach(e => {
        const item = document.createElement('div');
        item.className = 'grid-item';

        if (e === '') {
            item.textContent = '🗑️'; // Trash icon
            item.title = 'Remove Icon';
            item.style.fontSize = '1.2rem';
        } else {
            item.textContent = e;
        }

        if (profile && profile.icon === e) item.classList.add('selected');

        item.onclick = () => {
            document.querySelectorAll('#modal-emoji-grid .grid-item').forEach(x => x.classList.remove('selected'));
            if (e !== '') {
                item.classList.add('selected');
                modalIconVal.value = e;
            } else {
                modalIconVal.value = "";
            }
        };

        modalEmojiGrid.appendChild(item);
    });

    // Load containers
    containerSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Select Container...';
    containerSelect.appendChild(defaultOpt);

    const containers = await browser.contextualIdentities.query({});
    containers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.cookieStoreId;
        opt.textContent = c.name;
        opt.style.color = c.color;
        if (profile && profile.cookieStoreId === c.cookieStoreId) opt.selected = true;
        containerSelect.appendChild(opt);
    });

    modal.classList.remove('hidden');

    applyLanguage(currentLang);
}


createContainerBtn.onclick = () => {
    // Open Container Modal
    modal.classList.add('hidden');
    openContainerModal();
};

saveBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) return alert("Name required");

    const cookieStoreId = containerSelect.value;
    if (!cookieStoreId) return alert("Container required");

    const icon = modalIconVal.value || name.charAt(0).toUpperCase();

    if (editingProfileId) {
        // Update existing
        const idx = storedData.profiles.findIndex(p => p.id === editingProfileId);
        if (idx !== -1) {
            storedData.profiles[idx].name = name;
            storedData.profiles[idx].cookieStoreId = cookieStoreId;
            storedData.profiles[idx].icon = icon;
        }
    } else {
        // Create new
        const newProfile = {
            id: generateUUID(),
            name: name,
            cookieStoreId: cookieStoreId,
            icon: icon,
            color: '#' + (Math.random() * 0xFFFFFF << 0).toString(16)
        };
        storedData.profiles.push(newProfile);
    }

    await browser.storage.local.set({ [currentHostname]: storedData });

    modal.classList.add('hidden');
    renderGrid();
};

deleteBtn.onclick = async () => {
    if (!editingProfileId) return;
    if (!confirm("Delete this profile?")) return;

    storedData.profiles = storedData.profiles.filter(p => p.id !== editingProfileId);

    if (storedData.settings.defaultProfileId === editingProfileId) {
        storedData.settings.defaultProfileId = null;
        storedData.settings.dontShowAgain = false;
    }

    await browser.storage.local.set({ [currentHostname]: storedData });
    modal.classList.add('hidden');
    renderGrid();
};

cancelBtn.onclick = () => {
    modal.classList.add('hidden');
};

skipBtn.onclick = async () => {
    const tab = await browser.tabs.getCurrent();
    const cookieStoreId = tab.cookieStoreId;
    const savePref = mainDontShow ? mainDontShow.checked : false;
    let profileId = null;

    if (savePref) {
        // Check if a profile exists for this container
        const existingProfile = storedData.profiles.find(p => p.cookieStoreId === cookieStoreId);
        if (existingProfile) {
            profileId = existingProfile.id;
        } else {
            // NO DUMMY PROFILE CREATION
            profileId = null;
        }
    }

    browser.runtime.sendMessage({
        type: 'OPEN_URL',
        url: targetUrl,
        cookieStoreId: cookieStoreId,
        hostname: currentHostname,
        savePreference: savePref,
        profileId: profileId
    });
};

// Container Modal Logic
function openContainerModal() {
    cName.value = "";
    // Colors
    const colors = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple'];
    cColorGrid.innerHTML = '';
    colors.forEach(c => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.style.backgroundColor = getFirefoxColor(c);
        if (c === 'blue') item.classList.add('selected'); // default
        item.onclick = () => {
            document.querySelectorAll('#c-color-grid .grid-item').forEach(x => x.classList.remove('selected'));
            item.classList.add('selected');
            cColorVal.value = c;
        };
        cColorGrid.appendChild(item);
    });

    // Icons
    const icons = ['fingerprint', 'briefcase', 'dollar', 'cart', 'circle', 'gift', 'vacation', 'food', 'fruit', 'pet', 'tree', 'chill', 'fence'];
    cIconGrid.innerHTML = '';
    icons.forEach(i => {
        const item = document.createElement('div');
        item.className = 'grid-item';

        const img = document.createElement('img');
        img.src = 'icons/' + i + '.svg';
        img.style.width = '20px';
        img.style.height = '20px';
        img.style.pointerEvents = 'none'; // click goes to parent div

        item.appendChild(img);

        item.title = i;
        if (i === 'circle') item.classList.add('selected');
        item.onclick = () => {
            document.querySelectorAll('#c-icon-grid .grid-item').forEach(x => x.classList.remove('selected'));
            item.classList.add('selected');
            cIconVal.value = i;
        };
        cIconGrid.appendChild(item);
    });

    cModal.classList.remove('hidden');
}

function getFirefoxColor(name) {
    const map = {
        'blue': '#37adff', 'turquoise': '#00c79a', 'green': '#51cf66', 'yellow': '#fcc419',
        'orange': '#ff922b', 'red': '#ff6b6b', 'pink': '#f06595', 'purple': '#cc5de8'
    };
    return map[name] || '#777';
}

cCancel.onclick = () => {
    cModal.classList.add('hidden');
    modal.classList.remove('hidden');
}

cSave.onclick = async () => {
    const name = cName.value.trim();
    if (!name) return alert("Name required");

    const color = cColorVal.value;
    const icon = cIconVal.value;

    try {
        const newC = await browser.contextualIdentities.create({ name, color, icon });

        cModal.classList.add('hidden');
        modal.classList.remove('hidden');

        const opt = document.createElement('option');
        opt.value = newC.cookieStoreId;
        opt.textContent = newC.name;
        opt.style.color = newC.color;
        opt.selected = true;
        containerSelect.appendChild(opt);

    } catch (e) {
        alert("Error creating container: " + e.message);
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Start
init();
