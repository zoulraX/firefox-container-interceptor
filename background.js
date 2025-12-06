
// Whitelist specific tab IDs to allow one-time navigation
// Map<tabId, { url: string, timestamp: number }>
const tempWhitelist = new Map();

// Clean up old whitelist entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [tabId, data] of tempWhitelist) {
        if (now - data.timestamp > 10000) { // 10 seconds TTL
            tempWhitelist.delete(tabId);
        }
    }
}, 5000);

function isInterstitial(url) {
    return url.startsWith(browser.runtime.getURL("interstitial.html"));
}

// Extract hostname for preference storage
function getHostname(url) {
    try {
        const u = new URL(url);
        return u.hostname;
    } catch (e) {
        return null;
    }
}

browser.webRequest.onBeforeRequest.addListener(
    function (details) {
        if (details.frameId !== 0) return; // Only intercept main frame
        if (isInterstitial(details.url)) return; // Don't intercept our own UI

        const url = new URL(details.url);
        if (!['http:', 'https:'].includes(url.protocol)) return;

        // Check whitelist
        if (tempWhitelist.has(details.tabId)) {
            const entry = tempWhitelist.get(details.tabId);
            // Simple check: if the URL matches (or is close enough, to handle redirects? For now exact or startsWith)
            // Actually, let's just trust the tabId for the immediate next request.
            // But strict checking is better.
            if (details.url === entry.url || details.url.startsWith(entry.url)) {
                // Remove from whitelist to prevent permanent access, unless we navigate same tab?
                // Let's keep it for a few seconds or until completion.
                // Ideally, we want to allow the *first* navigation.
                tempWhitelist.delete(details.tabId);
                return;
            }
        }

        // Check storage preferences
        // Note: onBeforeRequest is synchronous blocking. 
        // We cannot await storage.local.get here easily in Chrome, but Firefox supports blocking promises?
        // Firefox `webRequest.onBeforeRequest` allows returning a Promise!

        return new Promise(async (resolve) => {
            const hostname = getHostname(details.url);
            if (!hostname) {
                resolve({});
                return;
            }

            try {
                const stored = await browser.storage.local.get(hostname);
                const pref = stored[hostname];

                if (pref && pref.dontShowAgain) {
                    // Check if we are in the right container
                    // pref.cookieStoreId is the desired one.
                    // details.cookieStoreId is the current one.

                    if (pref.cookieStoreId === details.cookieStoreId) {
                        // Correct container, allow.
                        resolve({});
                        return;
                    } else {
                        // Wrong container.
                        // We need to cancel this request and open in the right one.

                        // We cannot change cookieStoreId of an existing tab. Use tabs.create + tabs.remove.

                        await browser.tabs.create({
                            url: details.url,
                            cookieStoreId: pref.cookieStoreId,
                            active: true
                        });

                        // Close the old tab (the one that made the request).
                        await browser.tabs.remove(details.tabId);

                        resolve({ cancel: true });
                        return;
                    }
                }
            } catch (e) {
                console.error("Storage check error:", e);
            }

            // No preference, or explicit "Ask me".
            // Redirect to interstitial
            const targetUrl = encodeURIComponent(details.url);
            const interstitialUrl = browser.runtime.getURL(`interstitial.html?target=${targetUrl}`);

            resolve({ redirectUrl: interstitialUrl });
        });
    },
    { urls: ["<all_urls>"], types: ["main_frame"] },
    ["blocking"]
);

// Message listener from Interstitial
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'OPEN_URL') {
        const { url, cookieStoreId, savePreference, hostname } = message;

        if (savePreference && hostname) {
            await browser.storage.local.set({
                [hostname]: {
                    dontShowAgain: true,
                    cookieStoreId: cookieStoreId
                }
            });
        }

        // Check if we can stay in the same tab (preserve history)
        // sender.tab might be undefined if sent from non-tab context, but here it comes from interstitial page in a tab.
        if (sender.tab && sender.tab.cookieStoreId === cookieStoreId) {
            try {
                // Whitelist first to allow the request
                tempWhitelist.set(sender.tab.id, {
                    url: url,
                    timestamp: Date.now()
                });

                await browser.tabs.update(sender.tab.id, { url: url });
                // No need to remove sender tab, we updated it.
            } catch (e) {
                console.error("Tab update failed:", e);
            }
        } else {
            // Different container (or new tab requested implicitly), must create new tab
            try {
                const tab = await browser.tabs.create({
                    url: url,
                    cookieStoreId: cookieStoreId,
                    active: true,
                    index: sender.tab ? sender.tab.index + 1 : undefined
                });

                // Whitelist this tabId
                tempWhitelist.set(tab.id, {
                    url: url,
                    timestamp: Date.now()
                });

                // Close the interstitial tab (the sender)
                if (sender.tab && sender.tab.id) {
                    await browser.tabs.remove(sender.tab.id);
                }

            } catch (e) {
                console.error("Tab creation failed:", e);
            }
        }
    } else if (message.type === 'RESET_PREFS') {
        // ... implementation later
    }
});

// Menus
browser.menus.create({
    id: "reset-container-prefs",
    title: "Reset Container Settings for this Site",
    contexts: ["all"],
    onclick: async (info, tab) => {
        // Get hostname from info.pageUrl or tab.url
        const url = info.pageUrl || tab?.url;
        if (url) {
            const hostname = getHostname(url);
            if (hostname) {
                await browser.storage.local.remove(hostname);
                // Maybe show a notification?
                console.log(`Preferences reset for ${hostname}`);
                // Reload the page to trigger interception again?
                browser.tabs.reload(tab.id);
            }
        }
    }
});
