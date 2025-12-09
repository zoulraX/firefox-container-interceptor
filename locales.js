const translations = {
    "en": {
        "mySites": "My Sites",
        "settings": "Settings",
        "addSitePlaceholder": "example.com",
        "add": "Add",
        "addProfile": "Add Profile",
        "save": "Save",
        "cancel": "Cancel",
        "delete": "Delete",
        "deleteProfile": "Delete Profile",
        "create": "Create",
        "newProfile": "New Profile",
        "name": "Name",
        "icon": "Icon",
        "container": "Container",
        "newContainer": "New Container",
        "color": "Color",
        "selectContainer": "Select Container...",
        "warningSearch": "Warning: Using this extension with search engines is not recommended.",
        "invalidUrl": "Invalid URL",
        "nameRequired": "Name required",
        "containerRequired": "Container required",
        "profileDeleted": "Delete profile?",
        "noSites": "No active sites. Add one below.",
        "noProfiles": "No profiles yet.",
        "generalSettings": "General Settings",
        "interceptBehavior": "Intercept Behavior",
        "interceptAll": "Show selector for all sites (even if no profiles)",
        "interceptConfigured": "Only show for sites with configured profiles",
        "guest": "Guest",
        "guestTooltip": "Temporary container. Deleted when tab is closed.",
        "skip": "Skip",
        "dontShow": "Don't show this screen for this site",
        "target": "Target",
        "selectProfile": "Select Profile"
    }
};

function getTranslation(key, lang = 'en') {
    return translations['en'][key] || key;
}
