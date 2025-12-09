
// Context Menus
browser.menus.create({
    id: "open-selector",
    title: "Select Profile",
    contexts: ["page", "link"]
});

browser.menus.create({
    id: "add-profile",
    title: "Add Profile",
    contexts: ["page", "link"]
});

browser.menus.onClicked.addListener((info, tab) => {
    let targetUrl = info.linkUrl || info.pageUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) return;

    const encoded = encodeURIComponent(targetUrl);
    let finalUrl = browser.runtime.getURL(`interstitial.html?target=${encoded}`);

    if (info.menuItemId === "add-profile") {
        finalUrl += "&mode=add";
    }

    browser.tabs.update(tab.id, { url: finalUrl });
});

// Whitelist specific protection logic...
const tempWhitelist = new Map();
const guestSessions = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [tabId, data] of tempWhitelist) {
        if (now - data.timestamp > 15000) {
            tempWhitelist.delete(tabId);
        }
    }
}, 5000);

function isInterstitial(url) {
    return url.startsWith(browser.runtime.getURL("interstitial.html"));
}

function getHostname(url) {
    try {
        const u = new URL(url);
        return u.hostname;
    } catch (e) {
        return null;
    }
}

browser.tabs.onRemoved.addListener(async (tabId) => {
    if (guestSessions.has(tabId)) {
        const cookieStoreId = guestSessions.get(tabId);
        guestSessions.delete(tabId);
        try {
            await browser.contextualIdentities.remove(cookieStoreId);
            console.log(`Guest container ${cookieStoreId} removed for tab ${tabId}`);
        } catch (e) {
            console.error(`Failed to remove guest container ${cookieStoreId}:`, e);
        }
    }
});

browser.webRequest.onBeforeRequest.addListener(
    function (details) {
        if (details.frameId !== 0) return;
        if (isInterstitial(details.url)) return;

        const url = new URL(details.url);
        if (!['http:', 'https:'].includes(url.protocol)) return;

        // Check whitelist
        if (tempWhitelist.has(details.tabId)) {
            const entry = tempWhitelist.get(details.tabId);
            const now = Date.now();

            let match = false;
            try {
                if (entry.url === 'about:blank') {
                    match = true;
                } else {
                    const entryHost = new URL(entry.url).hostname.replace(/^www\./, '');
                    const currentHost = new URL(details.url).hostname.replace(/^www\./, '');
                    if (currentHost === entryHost || details.url.startsWith(entry.url)) {
                        match = true;
                    }
                }
            } catch (e) { }

            if (match && (now - entry.timestamp < 15000)) {
                return; // ALLOW
            } else {
                if (now - entry.timestamp > 15000) tempWhitelist.delete(details.tabId);
            }
        }

        return new Promise(async (resolve) => {
            const hostname = getHostname(details.url);
            if (!hostname) {
                resolve({});
                return;
            }

            try {
                // Fetch site specific data AND global settings
                const stored = await browser.storage.local.get([hostname, 'globalSettings']);
                const data = stored[hostname];
                const settings = stored.globalSettings || { language: 'en', interceptAll: true };

                // Ignore search engines (Regex based)
                if (!data) {
                    const searchRegex = /^(www\.)?(google\.|bing\.|yahoo\.|duckduckgo\.|yandex\.|baidu\.|ask\.)/i;
                    if (searchRegex.test(hostname)) {
                        resolve({});
                        return;
                    }

                    // Check Global Interception Preference (If unconfigured)
                    if (settings.interceptAll === false) {
                        resolve({});
                        return;
                    }
                }

                if (data) {
                    let shouldSkip = false;
                    let targetCookieStoreId = null;

                    if (data.settings && data.settings.dontShowAgain) {
                        // V2 Schema - Check preferredCookieStoreId OR defaultProfileId
                        if (data.settings.preferredCookieStoreId) {
                            shouldSkip = true;
                            targetCookieStoreId = data.settings.preferredCookieStoreId;
                        } else if (data.settings.defaultProfileId && data.profiles) {
                            const profile = data.profiles.find(p => p.id === data.settings.defaultProfileId);
                            if (profile) {
                                shouldSkip = true;
                                targetCookieStoreId = profile.cookieStoreId;
                            }
                        }
                    } else if (data.dontShowAgain && data.cookieStoreId) {
                        // V1 Schema
                        shouldSkip = true;
                        targetCookieStoreId = data.cookieStoreId;
                    }

                    if (shouldSkip && targetCookieStoreId) {
                        if (targetCookieStoreId === details.cookieStoreId) {
                            resolve({});
                            return;
                        } else {
                            try {
                                await browser.tabs.create({
                                    url: details.url,
                                    cookieStoreId: targetCookieStoreId,
                                    active: true
                                });
                                await browser.tabs.remove(details.tabId);
                                resolve({ cancel: true });
                            } catch (e) { }
                            return;
                        }
                    }
                }
            } catch (e) {
                console.error("Storage check error:", e);
            }

            // Show Interstitial
            const targetUrl = encodeURIComponent(details.url);
            const interstitialUrl = browser.runtime.getURL(`interstitial.html?target=${targetUrl}`);
            resolve({ redirectUrl: interstitialUrl });
        });
    },
    { urls: ["<all_urls>"], types: ["main_frame"] },
    ["blocking"]
);

// Message listener
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {

    if (message.type === 'CREATE_GUEST') {
        try {
            const container = await browser.contextualIdentities.create({
                name: "Guest " + Date.now().toString().slice(-4),
                color: "toolbar",
                icon: "circle"
            });
            // Send back the full container object
            return container;
        } catch (e) {
            console.error("Error creating guest container:", e);
        }
    }

    else if (message.type === 'OPEN_URL') {
        const { url, cookieStoreId, savePreference, hostname, profileId, isGuest } = message;

        if (savePreference && hostname) {
            try {
                const stored = await browser.storage.local.get(hostname);
                let data = stored[hostname] || { profiles: [], settings: {} };
                if (!data.settings) data.settings = {};

                data.settings.dontShowAgain = true;

                if (profileId) {
                    data.settings.defaultProfileId = profileId;
                    data.settings.preferredCookieStoreId = cookieStoreId;
                } else {
                    data.settings.defaultProfileId = null;
                    data.settings.preferredCookieStoreId = cookieStoreId;
                }

                await browser.storage.local.set({ [hostname]: data });
            } catch (e) { console.error("Save pref failed", e); }
        }

        // Check if we can stay in the same tab
        if (sender.tab && sender.tab.cookieStoreId === cookieStoreId) {
            try {
                // Whitelist first
                tempWhitelist.set(sender.tab.id, {
                    url: url,
                    timestamp: Date.now()
                });
                await browser.tabs.update(sender.tab.id, { url: url });

                if (isGuest) {
                    guestSessions.set(sender.tab.id, cookieStoreId);
                }
            } catch (e) { console.error("Tab update failed:", e); }
        } else {
            // New tab needed (Different container)
            try {
                const tab = await browser.tabs.create({
                    url: "about:blank",
                    cookieStoreId: cookieStoreId,
                    active: true,
                    index: sender.tab ? sender.tab.index + 1 : undefined
                });

                tempWhitelist.set(tab.id, { url: url, timestamp: Date.now() });

                if (isGuest) {
                    guestSessions.set(tab.id, cookieStoreId);
                }

                // Now navigate
                await browser.tabs.update(tab.id, { url: url });

                // Close sender
                if (sender.tab && sender.tab.id) {
                    await browser.tabs.remove(sender.tab.id);
                }
            } catch (e) {
                console.error("Tab creation failed:", e);
            }
        }
    }
});
