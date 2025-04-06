document.addEventListener("DOMContentLoaded", function () {
    const domainInput = document.getElementById("domain-input");
    const addButton = document.getElementById("add-domain");
    const domainList = document.getElementById("domain-list");
    const saveButton = document.getElementById("saveButton");
    const passwordPrompt = document.getElementById('password-prompt');
    const passwordInput = document.getElementById('password-input');
    const submitPasswordButton = document.getElementById('submit-password');
  
    const password = 'admin123'; // Predefined password for adding/removing domains
  
    // 🚀 Load Trusted Domains from Storage
    function loadDomains() {
        chrome.storage.sync.get("trustedDomains", function (data) {
            const domains = data.trustedDomains || [];
            domainList.innerHTML = ""; // Clear existing list
  
            domains.forEach((domain, index) => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <span>${domain}</span>
                    <button class="remove-btn" data-index="${index}" title="Remove">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
                domainList.appendChild(li);
            });
  
            attachRemoveListeners();
            checkAndLogout();  // Check if the current user should be logged out
        });
    }
  
    // 🚀 Attach event listeners to remove buttons
    function attachRemoveListeners() {
        document.querySelectorAll(".remove-btn").forEach(button => {
            button.addEventListener("click", function () {
                const index = parseInt(this.getAttribute("data-index"));
                passwordPrompt.style.display = 'block'; // Show password prompt for removal
                submitPasswordButton.onclick = function () {
                    const enteredPassword = passwordInput.value.trim();
                    if (enteredPassword === password) {
                        removeDomain(index); // Proceed to remove the domain if correct password is entered
                        passwordPrompt.style.display = 'none'; // Hide the password prompt
                        passwordInput.value = ''; // Clear password input
                    } else {
                        alert('Incorrect password!');
                        passwordInput.value = ''; // Clear password input
                    }
                };
            });
        });
    }
  
    // 🚀 Add a new domain
    addButton.addEventListener("click", function () {
        const newDomain = domainInput.value.trim().toLowerCase();
        if (!validateDomain(newDomain)) return;
  
        passwordPrompt.style.display = 'block'; // Show password prompt for adding domain
        submitPasswordButton.onclick = function () {
            const enteredPassword = passwordInput.value.trim();
            if (enteredPassword === password) {
                chrome.storage.sync.get("trustedDomains", function (data) {
                    let domains = data.trustedDomains || [];
                    if (!domains.includes(newDomain)) {
                        domains.push(newDomain);
                        chrome.storage.sync.set({ trustedDomains: domains }, function () {
                            domainInput.value = ""; // Clear domain input
                            loadDomains(); // Reload domain list and refresh the tab
                        });
                    } else {
                        alert("⚠️ This domain is already in the list.");
                    }
                });
                passwordPrompt.style.display = 'none'; // Hide the password prompt
                passwordInput.value = ''; // Clear password input
            } else {
                alert('Incorrect password!');
                passwordInput.value = ''; // Clear password input
            }
        };
    });
  
    // 🚀 Save multiple domains (comma-separated input)
    if (saveButton) {
        saveButton.addEventListener("click", function () {
            const input = domainInput.value.trim();
            const newDomains = input.split(',').map(domain => domain.trim().toLowerCase()).filter(domain => validateDomain(domain));
  
            if (newDomains.length === 0) {
                alert("⚠️ Please enter valid domain(s).");
                return;
            }
  
            // ✅ Merge new domains without replacing old ones
            chrome.storage.sync.get("trustedDomains", function (data) {
                let existingDomains = data.trustedDomains || [];
                newDomains.forEach(domain => {
                    if (!existingDomains.includes(domain)) {
                        existingDomains.push(domain);
                    }
                });
  
                chrome.storage.sync.set({ trustedDomains: existingDomains }, function () {
                    alert("✅ Trusted domains updated!");
                    loadDomains(); // Reload domain list and refresh the tab
                });
            });
        });
    }
  
    // 🚀 Validate Domain Input
    function validateDomain(domain) {
        if (!domain) {
            alert("⚠️ Please enter a valid domain.");
            return false;
        }
        if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
            alert("⚠️ Invalid domain format! Example: gmail.com");
            return false;
        }
        return true;
    }
  
    // 🚀 Remove a domain by index
    function removeDomain(index) {
        chrome.storage.sync.get("trustedDomains", function (data) {
            let domains = data.trustedDomains || [];
            if (index >= 0 && index < domains.length) {
                domains.splice(index, 1); // Remove domain by index
                chrome.storage.sync.set({ trustedDomains: domains }, function () {
                    loadDomains(); // Reload domain list
                    checkAndLogout();  // Check if the current user should be logged out
                });
            }
        });
    }
  
    // 🚀 Check if user needs to be logged out
    // 🚀 Check if user needs to be logged out
function checkAndLogout() {
    chrome.storage.sync.get("trustedDomains", function (data) {
        const trustedDomains = data.trustedDomains || [];

        // If there are no trusted domains, log the user out immediately
        if (trustedDomains.length === 0) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) {
                    chrome.tabs.update(tabs[0].id, { url: "https://accounts.google.com/Logout" });
                }
            });
            return;
        }

        // Get the currently logged-in user email domain
        chrome.identity.getProfileUserInfo(function(userInfo) {
            const userEmail = userInfo.email;
            const userDomain = userEmail.split('@')[1];

            // If the user domain is not in the trusted domains list, log the user out
            if (!trustedDomains.includes(userDomain)) {
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    if (tabs[0]) {
                        chrome.tabs.update(tabs[0].id, { url: "https://accounts.google.com/Logout" });
                    }
                });
            }
        });
    });
}

    // 🚀 Listen for storage updates (auto enforcement)
    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === "sync" && changes.trustedDomains) {
            loadDomains(); // Refresh the domain list and check for logout
        }
    });
  
    // 🚀 Initial Load
    loadDomains();

    // 🚀 Refresh the current tab after domain is added/removed
    function refreshCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.reload(tabs[0].id); // Reload the current tab
            }
        });
    }

    // 🚀 Listen for tab switch and refresh the focused tab
    chrome.tabs.onActivated.addListener(function(activeInfo) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.reload(tabs[0].id); // Reload the newly activated tab
            }
        });
    });
});
