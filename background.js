chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed. Checking if the scripting API is available.");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        if (tab.url.includes("mail.google.com") || tab.url.includes("accounts.google.com")) {
            chrome.storage.sync.get("trustedEntries", (data) => {
                chrome.tabs.sendMessage(tabId, {
                    action: "verifyGmailUser",
                    trustedEntries: data.trustedEntries || []
                });
            });
        }
    }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "sync" && changes.trustedEntries) {
        console.log("🔄 Trusted entries updated. Rechecking Gmail sessions...");
        await checkAndLogout();
    }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "checkAndLogout") {
        await checkAndLogout();
    }
});

async function checkAndLogout() {
    try {
        const data = await chrome.storage.sync.get("trustedEntries");
        const trustedEntries = data.trustedEntries || [];

        if (trustedEntries.length === 0) {
            console.log("❌ No trusted entries found. Logging out...");
            await logoutGmail();
            return;
        }

        const tabs = await chrome.tabs.query({});
        const gmailTabs = tabs.filter(tab =>
            tab.url && (tab.url.includes("mail.google.com") || tab.url.includes("accounts.google.com"))
        );

        for (let tab of gmailTabs) {
            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: "verifyGmailUser",
                    trustedEntries
                });
                if (!response) {
                    throw new Error("No response from content script");
                }
            } catch (error) {
                console.warn(`⚠️ Content script inactive in tab ${tab.id}. Injecting script...`);
                if (chrome.scripting) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ["content.js"]
                    });
                    await chrome.tabs.sendMessage(tab.id, {
                        action: "verifyGmailUser",
                        trustedEntries
                    });
                } else {
                    console.error("❌ chrome.scripting API is not available.");
                }
            }
        }
    } catch (error) {
        console.error("❌ Error in checkAndLogout():", error.message);
    }
}

async function logoutGmail() {
    try {
        const tabs = await chrome.tabs.query({});
        for (let tab of tabs) {
            if (tab.url && (tab.url.includes("mail.google.com") || tab.url.includes("accounts.google.com"))) {
                await chrome.tabs.update(tab.id, { url: "https://accounts.google.com/Logout" });
            }
        }
    } catch (error) {
        console.error("❌ Error in logoutGmail():", error.message);
    }
}

checkAndLogout();

async function verifyUserDomain(tabId) {
    try {
        const data = await chrome.storage.sync.get("trustedEntries");
        const trustedEntries = data.trustedEntries || [];

        chrome.tabs.sendMessage(tabId, { action: "getUserEmail" }, async (response) => {
            const userEmail = response.email;
            if (!userEmail) {
                console.warn("⚠️ User email not found on the page.");
                return;
            }

            const userDomain = userEmail.split('@')[1];
            if (!trustedEntries.includes(userEmail) && !trustedEntries.includes(userDomain)) {
                console.log(`❌ ${userEmail} is not a trusted entry. Logging out...`);
                await logoutGmail();
            }
        });
    } catch (error) {
        console.error("❌ Error in verifyUserDomain():", error.message);
    }
}