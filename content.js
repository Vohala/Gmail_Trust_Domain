console.log("🚀 Gmail Trusted Domain Restriction Activated");

// ✅ Store last detected unauthorized login to prevent duplicate alerts
let lastUnauthorizedEmail = null;

// ✅ Show a custom alert message
function showCustomAlert(message) {
    let alertContainer = document.getElementById("custom-alert");

    if (!alertContainer) {
        alertContainer = document.createElement("div");
        alertContainer.id = "custom-alert";
        alertContainer.classList.add("alert-container");
        document.body.appendChild(alertContainer);

        let alertBox = document.createElement("div");
        alertBox.classList.add("alert-box");
        alertContainer.appendChild(alertBox);

        let messageElement = document.createElement("p");
        messageElement.id = "alert-message";
        alertBox.appendChild(messageElement);

        let closeButton = document.createElement("button");
        closeButton.id = "close-alert";
        closeButton.classList.add("close-btn");
        closeButton.innerText = "Close";
        alertBox.appendChild(closeButton);

        closeButton.addEventListener("click", function () {
            alertContainer.style.opacity = "0";
            setTimeout(() => alertContainer.remove(), 300);
        });
    }

    document.getElementById("alert-message").innerText = message;
    alertContainer.style.display = "flex";
    alertContainer.style.opacity = "1";
}

// ✅ Extract domain from email
function getDomain(email) {
    return email.includes("@") ? email.split("@")[1].toLowerCase() : "";
}

// ✅ Check if email is from a trusted domain
function isTrustedDomain(email, trustedDomains) {
    return trustedDomains.includes(getDomain(email));
}

// ✅ Get the currently logged-in Gmail user
function getLoggedInGmail() {
    let emailSelectors = [
        "div.IxcUte",
        "div.gb_cb",
        "div.gb_Fb",
        "div[data-email]",
        "div.gb_xb"
    ];
    
    for (let selector of emailSelectors) {
        let emailElement = document.querySelector(selector);
        if (emailElement) {
            return emailElement.innerText.trim();
        }
    }

    let iframeEmail = getEmailFromIframe();
    return iframeEmail ? iframeEmail : null;
}

// ✅ Get Email from iframe (if Gmail loads inside one)
function getEmailFromIframe() {
    let iframe = document.querySelector("iframe");
    if (iframe) {
        let doc = iframe.contentDocument || iframe.contentWindow.document;
        let emailElement = doc.querySelector("div[data-email]");
        return emailElement ? emailElement.innerText.trim() : null;
    }
    return null;
}

// ✅ Wait until Gmail user is fully loaded before running checks
function waitForGmailUser(callback) {
    let attempts = 0;
    let checkInterval = setInterval(() => {
        let email = getLoggedInGmail();
        if (email || attempts > 10) {  // Stop trying after 10 attempts
            clearInterval(checkInterval);
            callback(email);
        }
        attempts++;
    }, 1000);
}

// ✅ Force Logout if unauthorized login is detected
function signOutFromAllAccounts(email) {
    if (sessionStorage.getItem("logoutFlag")) return;  // Prevent multiple logouts

    console.log(`🚨 Unauthorized login detected: ${email}`);
    showCustomAlert(`Unauthorized login detected: ${email}. Logging out...`);

    sessionStorage.setItem("logoutFlag", "true");

    setTimeout(() => {
        window.location.href = "https://accounts.google.com/Logout";
    }, 3000);
}

// ✅ Block unauthorized email input
function blockUnauthorizedLogin(trustedDomains) {
    let emailInput = document.querySelector("input[type='email']");
    if (!emailInput) return;

    emailInput.addEventListener("blur", function () {
        let enteredEmail = emailInput.value.trim();
        if (enteredEmail && !isTrustedDomain(enteredEmail, trustedDomains)) {
            showCustomAlert("Only trusted domains are allowed for login.");
            emailInput.value = "";
        }
    });
}

// ✅ Block unauthorized accounts from chooser screen
function filterAccountChooser(trustedDomains) {
    const emailElements = document.querySelectorAll("div.IxcUte, div.gb_cb, div.gb_Fb");
    emailElements.forEach((el) => {
        const email = el.textContent.trim();
        const parent = el.closest("[role='link']");

        if (!isTrustedDomain(email, trustedDomains)) {
            console.log(`❌ Hiding unauthorized account: ${email}`);
            showCustomAlert(`Blocked: ${email} is not allowed to log in.`);
            if (parent) parent.style.display = "none";
        }
    });
}

// ✅ Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("🔹 Message received:", request);

    if (request.action === "forceLogout") {
        console.log("🔐 Logging out due to no trusted domains...");
        window.location.href = "https://accounts.google.com/Logout";
        return;
    }

    if (request.action === "verifyGmailUser") {
        waitForGmailUser((loggedInEmail) => {
            let trustedDomains = request.trustedDomains || [];

            if (!loggedInEmail) {
                console.warn("⚠️ No logged-in Gmail account detected after waiting.");
                return;
            }

            let emailDomain = getDomain(loggedInEmail);

            if (!trustedDomains.includes(emailDomain)) {
                if (lastUnauthorizedEmail !== loggedInEmail) {
                    lastUnauthorizedEmail = loggedInEmail;
                    signOutFromAllAccounts(loggedInEmail);
                }
            } else {
                console.log(`✅ Authorized login: ${loggedInEmail} (Domain: ${emailDomain})`);
            }
        });
    }
});

// ✅ Monitor Gmail login attempts & enforce restrictions
chrome.storage.sync.get("trustedDomains", function (data) {
    const trustedDomains = data.trustedDomains || [];

    function runAllChecks() {
        blockUnauthorizedLogin(trustedDomains);
        filterAccountChooser(trustedDomains);
    }

    runAllChecks();

    const observer = new MutationObserver(() => {
        waitForGmailUser((email) => {
            if (email) {
                filterAccountChooser(trustedDomains);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
});

// ✅ Prevent repeated logouts (Fix logout loop)
if (window.location.href.includes("Logout")) {
    sessionStorage.setItem("justLoggedOut", "true");
}
if (sessionStorage.getItem("justLoggedOut") === "true") {
    setTimeout(() => {
        sessionStorage.removeItem("justLoggedOut");
    }, 5000);
}

// ✅ Ensure Gmail users are checked every time the domain list changes
chrome.storage.onChanged.addListener(() => {
    chrome.runtime.sendMessage({ action: "checkAndLogout" });
});

// ✅ Listen for changes to trusted domains and refresh Gmail tab if domains are updated
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "sync" && changes.trustedDomains) {
        console.log("🔄 Trusted domains updated. Rechecking Gmail sessions...");
        await checkAndLogout();
    }
});

// ✅ Force logout and reload tab if domain mismatch
async function checkAndLogout() {
    const data = await chrome.storage.sync.get("trustedDomains");
    const trustedDomains = data.trustedDomains || [];

    // Get the current email address of logged-in user
    let loggedInEmail = getLoggedInGmail();
    if (!loggedInEmail) {
        console.warn("⚠️ No logged-in Gmail account detected.");
        return;
    }

    let emailDomain = getDomain(loggedInEmail);

    // Check if domain matches the trusted domain
    if (!trustedDomains.includes(emailDomain)) {
        console.log(`❌ ${emailDomain} is not a trusted domain. Logging out...`);
        window.location.href = "https://accounts.google.com/Logout";
    }
}
