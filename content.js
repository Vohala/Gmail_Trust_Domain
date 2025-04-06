console.log("🚀 Gmail Trusted Domain Restriction Activated");

let lastUnauthorizedEmail = null;

function showCustomAlert(message) {
    let alertContainer = document.getElementById("custom-alert");
    if (!alertContainer) {
        alertContainer = document.createElement("div");
        alertContainer.id = "custom-alert";
        document.body.appendChild(alertContainer);
        let alertBox = document.createElement("div");
        alertBox.innerHTML = `<p id="alert-message">${message}</p><button id="close-alert">Close</button>`;
        alertContainer.appendChild(alertBox);
        document.getElementById("close-alert").addEventListener("click", () => {
            alertContainer.style.opacity = "0";
            setTimeout(() => alertContainer.remove(), 300);
        });
    }
    document.getElementById("alert-message").innerText = message;
    alertContainer.style.display = "flex";
    alertContainer.style.opacity = "1";
}

function getDomain(email) {
    return email.includes("@") ? email.split("@")[1].toLowerCase() : "";
}

function isTrustedEntry(email, trustedEntries) {
    return trustedEntries.includes(email) || trustedEntries.includes(getDomain(email));
}

function getLoggedInGmail() {
    let emailSelectors = ["div.IxcUte", "div.gb_cb", "div.gb_Fb", "div[data-email]", "div.gb_xb"];
    for (let selector of emailSelectors) {
        let emailElement = document.querySelector(selector);
        if (emailElement) return emailElement.innerText.trim();
    }
    let iframeEmail = getEmailFromIframe();
    return iframeEmail || null;
}

function getEmailFromIframe() {
    let iframe = document.querySelector("iframe");
    if (iframe) {
        let doc = iframe.contentDocument || iframe.contentWindow.document;
        let emailElement = doc.querySelector("div[data-email]");
        return emailElement ? emailElement.innerText.trim() : null;
    }
    return null;
}

function waitForGmailUser(callback) {
    let attempts = 0;
    let checkInterval = setInterval(() => {
        let email = getLoggedInGmail();
        if (email || attempts > 10) {
            clearInterval(checkInterval);
            callback(email);
        }
        attempts++;
    }, 1000);
}

function signOutFromAllAccounts(email) {
    if (sessionStorage.getItem("logoutFlag")) return;
    console.log(`🚨 Unauthorized login detected: ${email}`);
    showCustomAlert(`Unauthorized login detected: ${email}. Logging out...`);
    sessionStorage.setItem("logoutFlag", "true");
    setTimeout(() => {
        window.location.href = "https://accounts.google.com/Logout";
    }, 3000);
}

function blockUnauthorizedLogin(trustedEntries) {
    let emailInput = document.querySelector("input[type='email']");
    if (!emailInput) return;
    emailInput.addEventListener("blur", function () {
        let enteredEmail = emailInput.value.trim();
        if (enteredEmail && !isTrustedEntry(enteredEmail, trustedEntries)) {
            showCustomAlert("Only trusted emails or domains are allowed for login.");
            emailInput.value = "";
        }
    });
}

function filterAccountChooser(trustedEntries) {
    const emailElements = document.querySelectorAll("div.IxcUte, div.gb_cb, div.gb_Fb");
    emailElements.forEach((el) => {
        const email = el.textContent.trim();
        const parent = el.closest("[role='link']");
        if (!isTrustedEntry(email, trustedEntries)) {
            console.log(`❌ Hiding unauthorized account: ${email}`);
            showCustomAlert(`Blocked: ${email} is not allowed to log in.`);
            if (parent) parent.style.display = "none";
        }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("🔹 Message received:", request);
    if (request.action === "forceLogout") {
        console.log("🔐 Logging out due to no trusted entries...");
        window.location.href = "https://accounts.google.com/Logout";
        return;
    }
    if (request.action === "verifyGmailUser") {
        waitForGmailUser((loggedInEmail) => {
            let trustedEntries = request.trustedEntries || [];
            if (!loggedInEmail) {
                console.warn("⚠️ No logged-in Gmail account detected after waiting.");
                return;
            }
            if (!isTrustedEntry(loggedInEmail, trustedEntries)) {
                if (lastUnauthorizedEmail !== loggedInEmail) {
                    lastUnauthorizedEmail = loggedInEmail;
                    signOutFromAllAccounts(loggedInEmail);
                }
            } else {
                console.log(`✅ Authorized login: ${loggedInEmail}`);
            }
        });
    }
});

chrome.storage.sync.get("trustedEntries", function (data) {
    const trustedEntries = data.trustedEntries || [];
    function runAllChecks() {
        blockUnauthorizedLogin(trustedEntries);
        filterAccountChooser(trustedEntries);
    }
    runAllChecks();
    const observer = new MutationObserver(() => {
        waitForGmailUser((email) => {
            if (email) filterAccountChooser(trustedEntries);
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

if (window.location.href.includes("Logout")) {
    sessionStorage.setItem("justLoggedOut", "true");
}
if (sessionStorage.getItem("justLoggedOut") === "true") {
    setTimeout(() => {
        sessionStorage.removeItem("justLoggedOut");
    }, 5000);
}

chrome.storage.onChanged.addListener(() => {
    chrome.runtime.sendMessage({ action: "checkAndLogout" });
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "sync" && changes.trustedEntries) {
        console.log("🔄 Trusted entries updated. Rechecking Gmail sessions...");
        await checkAndLogout();
    }
});

async function checkAndLogout() {
    const data = await chrome.storage.sync.get("trustedEntries");
    const trustedEntries = data.trustedEntries || [];
    let loggedInEmail = getLoggedInGmail();
    if (!loggedInEmail) {
        console.warn("⚠️ No logged-in Gmail account detected.");
        return;
    }
    if (!isTrustedEntry(loggedInEmail, trustedEntries)) {
        console.log(`❌ ${loggedInEmail} is not a trusted entry. Logging out...`);
        window.location.href = "https://accounts.google.com/Logout";
    }
}