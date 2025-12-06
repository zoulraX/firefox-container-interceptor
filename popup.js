
const list = document.getElementById('assignments-list');

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

async function loadAssignments() {
    list.innerHTML = '';
    const stored = await browser.storage.local.get(null);
    const keys = Object.keys(stored);

    if (keys.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'empty-msg';
        msg.textContent = "No sites assigned.";
        list.appendChild(msg);
        return;
    }

    // Need to fetch container info to show names properly
    let containers = [];
    try {
        containers = await browser.contextualIdentities.query({});
    } catch (e) { }

    keys.forEach(hostname => {
        const data = stored[hostname];
        if (!data.cookieStoreId) return;

        const item = document.createElement('div');
        item.className = 'assignment-item';

        const info = document.createElement('div');
        info.className = 'assignment-info';

        const siteName = document.createElement('span');
        siteName.className = 'site-name';
        siteName.textContent = hostname;

        const containerName = document.createElement('span');
        containerName.className = 'container-name';

        // Find container name
        let cName = "Default";
        let cColor = "toolbar";
        if (data.cookieStoreId !== 'firefox-default') {
            const c = containers.find(x => x.cookieStoreId === data.cookieStoreId);
            if (c) {
                cName = c.name;
                cColor = c.color;
            } else {
                cName = "Unknown Container";
            }
        }

        // Color Icon
        const icon = document.createElement('span');
        icon.style.width = '10px';
        icon.style.height = '10px';
        icon.style.borderRadius = '50%';
        icon.style.backgroundColor = colorMap[cColor] || cColor;
        icon.style.display = 'inline-block';

        containerName.appendChild(icon);
        containerName.appendChild(document.createTextNode(cName));

        info.appendChild(siteName);
        info.appendChild(containerName);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = "Remove assignment";
        removeBtn.onclick = async () => {
            await browser.storage.local.remove(hostname);
            loadAssignments();
        };

        item.appendChild(info);
        item.appendChild(removeBtn);
        list.appendChild(item);
    });
}

loadAssignments();
