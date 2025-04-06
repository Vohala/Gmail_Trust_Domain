document.addEventListener("DOMContentLoaded", function () {
    const domainInput = document.getElementById("domain-input");
    const addButton = document.getElementById("add-domain");
    const domainList = document.getElementById("domain-list");
    const passwordPrompt = document.getElementById('password-prompt');
    const passwordInput = document.getElementById('password-input');
    const submitPasswordButton = document.getElementById('submit-password');

    const password = 'admin123'; // Predefined password

    

    // Load Trusted Entries from Storage
    function loadDomains() {
        chrome.storage.sync.get("trustedEntries", function (data) {
            const entries = data.trustedEntries || [];
            domainList.innerHTML = ""; // Clear existing list

            entries.forEach((entry, index) => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <span>${entry}</span>
                    <button class="remove-btn" data-index="${index}" title="Remove">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
                domainList.appendChild(li);
            });

            attachRemoveListeners();
            checkAndLogout();
        });
    }

    // Attach event listeners to remove buttons
    function attachRemoveListeners() {
        document.querySelectorAll(".remove-btn").forEach(button => {
            button.addEventListener("click", function () {
                const index = parseInt(this.getAttribute("data-index"));
                passwordPrompt.style.display = 'block';
                submitPasswordButton.onclick = function () {
                    const enteredPassword = passwordInput.value.trim();
                    if (enteredPassword === password) {
                        removeEntry(index);
                        passwordPrompt.style.display = 'none';
                        passwordInput.value = '';
                    } else {
                        alert('Incorrect password!');
                        passwordInput.value = '';
                    }
                };
            });
        });
    }

    // Add a new entry (domain or email)
    addButton.addEventListener("click", function () {
        const newEntry = domainInput.value.trim().toLowerCase();
        if (!validateEntry(newEntry)) return;

        passwordPrompt.style.display = 'block';
        submitPasswordButton.onclick = function () {
            const enteredPassword = passwordInput.value.trim();
            if (enteredPassword === password) {
                chrome.storage.sync.get("trustedEntries", function (data) {
                    let entries = data.trustedEntries || [];
                    if (!entries.includes(newEntry)) {
                        entries.push(newEntry);
                        chrome.storage.sync.set({ trustedEntries: entries }, function () {
                            domainInput.value = "";
                            loadDomains();
                        });
                    } else {
                        alert("⚠️ This entry is already in the list.");
                    }
                });
                passwordPrompt.style.display = 'none';
                passwordInput.value = '';
            } else {
                alert('Incorrect password!');
                passwordInput.value = '';
            }
        };
    });

    // Validate Entry (domain or email)
    function validateEntry(entry) {
        if (!entry) {
            alert("⚠️ Please enter a valid domain or email.");
            return false;
        }
        // Email format: user@domain.com
        if (entry.includes('@')) {
            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(entry)) {
                alert("⚠️ Invalid email format! Example: user@example.com");
                return false;
            }
        }
        // Domain format: domain.com
        else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(entry)) {
            alert("⚠️ Invalid domain format! Example: example.com");
            return false;
        }
        return true;
    }

    // Remove an entry by index
    function removeEntry(index) {
        chrome.storage.sync.get("trustedEntries", function (data) {
            let entries = data.trustedEntries || [];
            if (index >= 0 && index < entries.length) {
                entries.splice(index, 1);
                chrome.storage.sync.set({ trustedEntries: entries }, function () {
                    loadDomains();
                    checkAndLogout();
                });
            }
        });
    }

    // Check if user needs to be logged out
    function checkAndLogout() {
        chrome.storage.sync.get("trustedEntries", function (data) {
            const trustedEntries = data.trustedEntries || [];
            if (trustedEntries.length === 0) {
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    if (tabs[0]) {
                        chrome.tabs.update(tabs[0].id, { url: "https://accounts.google.com/Logout" });
                    }
                });
                return;
            }

            chrome.identity.getProfileUserInfo(function (userInfo) {
                const userEmail = userInfo.email;
                const userDomain = userEmail.split('@')[1];
                const isAllowed = trustedEntries.includes(userEmail) || trustedEntries.includes(userDomain);
                if (!isAllowed) {
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        if (tabs[0]) {
                            chrome.tabs.update(tabs[0].id, { url: "https://accounts.google.com/Logout" });
                        }
                    });
                }
            });
        });
    }

    // Storage change listener
    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === "sync" && changes.trustedEntries) {
            loadDomains();
        }
    });

    document.getElementById("close-popup").addEventListener("click", function () {
        window.close(); // Closes the popup window
    });

    // Initial Load
    loadDomains();

    // Refresh tab on change
    function refreshCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    }

    chrome.tabs.onActivated.addListener(function (activeInfo) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    });
});