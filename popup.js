
// DOM Elements
const mainView = document.getElementById('main-view');
const detailView = document.getElementById('detail-view');
const settingsView = document.getElementById('settings-view');
const exceptionsView = document.getElementById('exceptions-view');

const headerTitle = document.getElementById('header-title');
const backBtn = document.getElementById('back-btn');
const settingsBtn = document.getElementById('settings-btn');

const openExceptionsBtn = document.getElementById('open-exceptions-btn');

const sitesList = document.getElementById('sites-list');
const profileList = document.getElementById('profile-list');
const newSiteInput = document.getElementById('new-site-input');
const addSiteBtn = document.getElementById('add-site-btn');
const addProfileBtn = document.getElementById('add-profile-btn');

// Settings Elements
const settingsIntercept = document.getElementById('settings-intercept');
const settingsSave = document.getElementById('settings-save');

// Profile Modal Elements
const modal = document.getElementById('popup-modal');
const pName = document.getElementById('p-name');
const pContainer = document.getElementById('p-container');
const pSave = document.getElementById('p-save');
const pCancel = document.getElementById('p-cancel');
const pCreateContainer = document.getElementById('p-create-container-btn');
const pEmojiGrid = document.getElementById('p-emoji-grid');
const pIconVal = document.getElementById('p-icon-val');

// Container Modal Elements
const cModal = document.getElementById('container-modal');
const cName = document.getElementById('c-name');
const cSave = document.getElementById('c-save');
const cCancel = document.getElementById('c-cancel');
const cColorGrid = document.getElementById('c-color-grid');
const cIconGrid = document.getElementById('c-icon-grid');
const cColorVal = document.getElementById('c-color-val');
const cIconVal = document.getElementById('c-icon-val');

let currentSite = null;
const currentLang = 'en'; // Hardcoded En

// Keeps track of where back button goes. Simple one-level history.
let previousView = 'main';

// Init
async function init() {
    // We still load settings in case we need interceptAll, but lang is 'en'
    const stored = await browser.storage.local.get('globalSettings');
    const settings = stored.globalSettings || { language: 'en', interceptAll: true };

    // Apply Language (Static 'en')
    applyLanguage('en');

    // Show Main
    showMain();
}

function applyLanguage(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = getTranslation(key, lang);
    });

    // Updates placeholders or titles if needed (manual)
    if (newSiteInput) newSiteInput.placeholder = getTranslation('addSitePlaceholder', lang);
}

// Routing
function hideAllViews() {
    mainView.classList.add('hidden');
    detailView.classList.add('hidden');
    settingsView.classList.add('hidden');
    exceptionsView.classList.add('hidden');
}

function showMain() {
    hideAllViews();
    mainView.classList.remove('hidden');
    backBtn.classList.add('hidden');
    settingsBtn.classList.remove('hidden');
    headerTitle.textContent = getTranslation('mySites', currentLang);
    currentSite = null;
    previousView = 'main';
    loadSites();
}

function showDetail(hostname) {
    hideAllViews();
    detailView.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    settingsBtn.classList.add('hidden');
    headerTitle.textContent = hostname;
    currentSite = hostname;
    previousView = 'main'; // Back goes to main
    loadProfiles(hostname);
}

async function showSettings() {
    hideAllViews();
    settingsView.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    settingsBtn.classList.add('hidden');
    headerTitle.textContent = getTranslation('settings', currentLang);
    previousView = 'main'; // Back goes to main

    // Load current settings
    const stored = await browser.storage.local.get('globalSettings');
    const settings = stored.globalSettings || { language: 'en', interceptAll: true };

    settingsIntercept.value = settings.interceptAll ? "all" : "configured";
}

async function showExceptions() {
    hideAllViews();
    exceptionsView.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    settingsBtn.classList.add('hidden');
    headerTitle.textContent = "Exceptions";
    previousView = 'settings'; // Back goes to settings!
    loadExceptions();
}

// Button Handlers
backBtn.onclick = () => {
    if (previousView === 'settings') {
        showSettings();
    } else {
        showMain();
    }
};
settingsBtn.onclick = showSettings;

if (openExceptionsBtn) {
    openExceptionsBtn.onclick = showExceptions;
}

settingsSave.onclick = async () => {
    const interceptAll = settingsIntercept.value === "all";

    await browser.storage.local.set({
        globalSettings: { language: 'en', interceptAll: interceptAll }
    });

    // Reload to apply
    location.reload();
};


async function loadExceptions() {
    const list = document.getElementById('exceptions-list');
    list.innerHTML = 'Loading...';

    const stored = await browser.storage.local.get(null);
    const hostnames = Object.keys(stored).filter(k => k.includes('.') && k !== 'globalSettings');

    const exceptions = [];
    hostnames.forEach(host => {
        const data = stored[host];
        if (data && data.settings && data.settings.dontShowAgain) {
            exceptions.push({ host, data });
        }
    });

    list.innerHTML = '';
    if (exceptions.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.color = '#777';
        emptyDiv.style.fontStyle = 'italic';
        emptyDiv.style.padding = '10px';
        emptyDiv.textContent = getTranslation('noSites', currentLang) || 'No exceptions.';
        list.appendChild(emptyDiv);
    } else {
        exceptions.forEach(ex => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '10px';
            row.style.backgroundColor = '#333';
            row.style.marginBottom = '5px';
            row.style.borderRadius = '4px';

            const hostSpan = document.createElement('span');
            hostSpan.textContent = ex.host;

            const removeSpan = document.createElement('span');
            removeSpan.style.color = '#f06595';
            removeSpan.style.cursor = 'pointer';
            removeSpan.style.fontWeight = 'bold';
            removeSpan.style.padding = '0 5px';
            removeSpan.title = 'Remove exception';
            removeSpan.textContent = '×';

            row.appendChild(hostSpan);
            row.appendChild(removeSpan);

            removeSpan.onclick = async () => {
                const newData = ex.data;
                newData.settings.dontShowAgain = false;

                await browser.storage.local.set({ [ex.host]: newData });
                loadExceptions();
            };

            list.appendChild(row);
        });
    }
}


// Data Loading
async function loadSites() {
    sitesList.innerHTML = '';
    const stored = await browser.storage.local.get(null);
    const hostnames = Object.keys(stored).filter(k => k.includes('.') && k !== 'globalSettings');

    let hasSites = false;
    hostnames.forEach(host => {
        const count = stored[host].profiles ? stored[host].profiles.length : 0;
        if (count > 0) {
            hasSites = true;
            const item = document.createElement('div');
            item.className = 'site-item';
            const intro = document.createElement('div');
            intro.className = 'site-intro';

            const domain = document.createElement('div');
            domain.className = 'site-domain';
            domain.textContent = host;

            const meta = document.createElement('div');
            meta.className = 'site-meta';
            meta.textContent = count + ' profiles';

            intro.appendChild(domain);
            intro.appendChild(meta);

            const arrow = document.createElement('div');
            arrow.style.fontSize = '1.5rem';
            arrow.textContent = '›';

            item.appendChild(intro);
            item.appendChild(arrow);
            item.onclick = () => showDetail(host);
            sitesList.appendChild(item);
        }
    });

    if (!hasSites) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = getTranslation('noSites', currentLang);
        sitesList.appendChild(emptyDiv);
    }
}

function getContainerName(id, containers) {
    if (id === 'firefox-default') return 'No Container';
    const c = containers.find(x => x.cookieStoreId === id);
    return c ? c.name : 'Unknown';
}

async function loadProfiles(hostname) {
    profileList.innerHTML = 'Loading...';
    const stored = await browser.storage.local.get(hostname);
    const data = stored[hostname];

    if (!data || !data.profiles || data.profiles.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = getTranslation('noProfiles', currentLang);
        profileList.innerHTML = '';
        profileList.appendChild(emptyDiv);
    } else {
        profileList.innerHTML = '';
        const containers = await browser.contextualIdentities.query({});
        data.profiles.forEach(p => {
            const row = document.createElement('div');
            row.className = 'profile-item';
            const cName = getContainerName(p.cookieStoreId, containers);

            const icon = document.createElement('div');
            icon.className = 'profile-icon';
            icon.style.backgroundColor = p.color;
            icon.style.color = 'white';
            icon.textContent = p.icon || p.name[0];

            const info = document.createElement('div');
            info.className = 'profile-info';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'profile-name';
            nameSpan.textContent = p.name;

            const containerSpan = document.createElement('span');
            containerSpan.className = 'profile-container';
            containerSpan.textContent = cName;

            info.appendChild(nameSpan);
            info.appendChild(containerSpan);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-btn';
            deleteButton.textContent = '×';

            row.appendChild(icon);
            row.appendChild(info);
            row.appendChild(deleteButton);

            deleteButton.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(getTranslation('profileDeleted', currentLang) + ' ' + p.name + '?')) {
                    const newData = stored[hostname];
                    newData.profiles = newData.profiles.filter(x => x.id !== p.id);
                    await browser.storage.local.set({ [hostname]: newData });
                    loadProfiles(hostname);
                }
            };
            profileList.appendChild(row);
        });
    }
}

// Add Site
addSiteBtn.onclick = async () => {
    const val = newSiteInput.value.trim();
    if (!val) return;

    let hostname;
    try {
        if (!val.startsWith('http')) {
            hostname = new URL('http://' + val).hostname;
        } else {
            hostname = new URL(val).hostname;
        }
    } catch (e) {
        alert(getTranslation('invalidUrl', currentLang));
        return;
    }

    const SEARCH_ENGINES = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'yandex.com', 'baidu.com', 'ask.com'];
    if (SEARCH_ENGINES.some(se => hostname === se || hostname.endsWith('.' + se))) {
        alert(getTranslation('warningSearch', currentLang));
    }

    const stored = await browser.storage.local.get(hostname);
    if (!stored[hostname]) {
        await browser.storage.local.set({ [hostname]: { profiles: [], settings: {} } });
    }

    showDetail(hostname);
    openModal();
    newSiteInput.value = "";
}

// Modal - Profile
addProfileBtn.onclick = () => openModal();

async function openModal() {
    pName.value = "";
    pIconVal.value = "";

    const emojis = ['😀', '😎', '🤖', '👻', '🚀', '💻', '🍕', '🐱', '🐶', '🌳', ''];
    pEmojiGrid.innerHTML = '';
    emojis.forEach(e => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        if (e === '') {
            item.textContent = '🗑️';
        } else {
            item.textContent = e;
        }

        item.onclick = () => {
            document.querySelectorAll('#p-emoji-grid .grid-item').forEach(x => x.classList.remove('selected'));
            if (e !== '') {
                item.classList.add('selected');
                pIconVal.value = e;
            } else {
                pIconVal.value = "";
            }
        };
        pEmojiGrid.appendChild(item);
    });

    pContainer.innerHTML = '';
    const containers = await browser.contextualIdentities.query({});

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = getTranslation('selectContainer', currentLang);
    pContainer.appendChild(defaultOpt);

    containers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.cookieStoreId;
        opt.textContent = c.name;
        opt.style.color = c.color;
        pContainer.appendChild(opt);
    });

    modal.classList.remove('hidden');
}

pCreateContainer.onclick = () => {
    modal.classList.add('hidden');
    openContainerModal();
};

pCancel.onclick = () => modal.classList.add('hidden');

pSave.onclick = async () => {
    const name = pName.value.trim();
    const cid = pContainer.value;

    if (!name) return alert(getTranslation('nameRequired', currentLang));
    if (!cid) return alert(getTranslation('containerRequired', currentLang));

    const stored = await browser.storage.local.get(currentSite);
    const data = stored[currentSite] || { profiles: [], settings: {} };

    const icon = pIconVal.value || name[0].toUpperCase();

    const newProfile = {
        id: Date.now().toString(),
        name: name,
        cookieStoreId: cid,
        icon: icon,
        color: '#' + (Math.random() * 0xFFFFFF << 0).toString(16)
    };

    if (!data.profiles) data.profiles = [];
    data.profiles.push(newProfile);

    await browser.storage.local.set({ [currentSite]: data });

    modal.classList.add('hidden');
    loadProfiles(currentSite);
}

// Container Modal
function openContainerModal() {
    cName.value = "";
    const colors = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple'];
    cColorGrid.innerHTML = '';
    colors.forEach(c => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.style.backgroundColor = getFirefoxColor(c);
        if (c === 'blue') item.classList.add('selected');
        item.onclick = () => {
            document.querySelectorAll('#c-color-grid .grid-item').forEach(x => x.classList.remove('selected'));
            item.classList.add('selected');
            cColorVal.value = c;
        };
        cColorGrid.appendChild(item);
    });

    const icons = ['fingerprint', 'briefcase', 'dollar', 'cart', 'circle', 'gift', 'vacation', 'food', 'fruit', 'pet', 'tree', 'chill', 'fence'];
    cIconGrid.innerHTML = '';
    icons.forEach(i => {
        const item = document.createElement('div');
        item.className = 'grid-item';

        const img = document.createElement('img');
        img.src = 'icons/' + i + '.svg';
        img.style.width = '20px';
        img.style.height = '20px';
        img.style.pointerEvents = 'none';

        item.appendChild(img);

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
    if (!name) return alert(getTranslation('nameRequired', currentLang));

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
        pContainer.appendChild(opt);
    } catch (e) {
        alert("Error: " + e.message);
    }
}

init();
