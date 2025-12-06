
const params = new URLSearchParams(window.location.search);
const targetUrl = params.get('target');
const targetSiteEl = document.getElementById('target-site');
const optionsListError = document.getElementById('options-list');
const dontShowAgainCheckbox = document.getElementById('dont-show-again');

const colorMap = {
    'blue': '#37adff',
    'turquoise': '#00c79a',
    'green': '#51cf66',
    'yellow': '#fcc419',
    'orange': '#ff922b',
    'red': '#ff6b6b',
    'pink': '#f06595',
    'purple': '#cc5de8',
    'toolbar': '#777'
};

if (!targetUrl) {
    targetSiteEl.textContent = "No target URL specified.";
} else {
    try {
        const u = new URL(targetUrl);
        targetSiteEl.textContent = `You are visiting ${u.hostname}`;
    } catch (e) {
        targetSiteEl.textContent = `You are visiting ${targetUrl}`;
    }
}

function createOption(name, color, cookieStoreId, isDefault = false) {
    const button = document.createElement('button');

    // Icon/Color circle
    const icon = document.createElement('span');
    icon.className = 'icon-circle';
    icon.style.backgroundColor = colorMap[color] || color || '#777';
    if (isDefault) {
        icon.style.border = "2px solid #aaa";
        icon.style.backgroundColor = "transparent";
    }

    const label = document.createElement('span');
    label.textContent = name;

    button.appendChild(icon);
    button.appendChild(label);

    button.addEventListener('click', () => {
        // Send message to background
        let hostname = null;
        try { hostname = new URL(targetUrl).hostname; } catch (e) { }

        browser.runtime.sendMessage({
            type: 'OPEN_URL',
            url: targetUrl,
            cookieStoreId: cookieStoreId, // 'firefox-default' or 'firefox-container-X'
            savePreference: dontShowAgainCheckbox.checked,
            hostname: hostname
        });

        // Visual feedback (optional since tab will likely close/change)
        button.textContent = "Opening...";
        button.disabled = true;
    });

    return button;
}

async function loadOptions() {
    const list = document.getElementById('options-list');
    list.innerHTML = '';

    // 1. Default / No Container
    list.appendChild(createOption("No Container", "toolbar", "firefox-default", true));

    // 2. Fetch Containers
    try {
        const containers = await browser.contextualIdentities.query({});
        containers.forEach(container => {
            list.appendChild(createOption(container.name, container.color, container.cookieStoreId));
        });
    } catch (e) {
        console.error("Error fetching containers:", e);
        const err = document.createElement('div');
        err.textContent = "Could not load containers. Permissions might be missing.";
        list.appendChild(err);
    }
}

loadOptions();
