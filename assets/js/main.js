document.addEventListener('DOMContentLoaded', function() {
    // Prevent form resubmission on page reload
    if (window.history.replaceState) {
        window.history.replaceState(null, null, window.location.href);
    }

    // ---------------- IMAGE UPLOAD ----------------
    const form = document.querySelector('form');
    if (form) form.reset();

    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';

    const imageMaxSize = 12 * 1024 * 1024; // 12MB
    const imageAllowedExtensions = ["jpg", "jpeg", "png", "webp"];
    const errorMessage = document.getElementById("error-message");

    function validateImageFile(file) {
        errorMessage.textContent = "";
        if (!file) return false;

        const ext = file.name.split(".").pop().toLowerCase();
        if (!imageAllowedExtensions.includes(ext)) {
            errorMessage.textContent = "❌ Invalid file type. Allowed: JPG, JPEG, PNG, WEBP.";
            return false;
        }
        if (file.size > imageMaxSize) {
            errorMessage.textContent = `❌ File size exceeds 12 MB. Your file is ${(file.size / (1024*1024)).toFixed(2)} MB.`;
            return false;
        }
        return true;
    }

    // ---------------- PDF UPLOAD ----------------
    const pdfMaxSize = 5 * 1024 * 1024; // 5MB
    const pdfAllowedExtensions = ["pdf"];

    function validatePDFFile(file) {
        errorMessage.textContent = "";
        if (!file) return false;

        const ext = file.name.split(".").pop().toLowerCase();
        if (!pdfAllowedExtensions.includes(ext)) {
            errorMessage.textContent = "❌ Invalid file type. Only PDF allowed.";
            return false;
        }
        if (file.size > pdfMaxSize) {
            errorMessage.textContent = `❌ File size exceeds 5 MB. Your file is ${(file.size / (1024*1024)).toFixed(2)} MB.`;
            return false;
        }
        return true;
    }

    // ---------------- Progress UI ----------------
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar");
    const uploadStatus = document.getElementById("upload-status");

    // CSRF token helper function
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // ---------------- FILE INPUT HANDLER ----------------
    if (fileInput) {
        fileInput.addEventListener("change", function() {
            const file = this.files[0];
            if (!file) return;

            let isValid = false;
            if (pdfAllowedExtensions.includes(file.name.split(".").pop().toLowerCase())) {
                isValid = validatePDFFile(file);
            } else {
                isValid = validateImageFile(file);
            }

            if (!isValid) {
                this.value = "";
                return;
            }

            // Create a new clean form data object
            const formData = new FormData();
            formData.append('file', file);
            
            // Add any other necessary form fields except the file input itself
            const allFormElements = form.elements;
            for (let i = 0; i < allFormElements.length; i++) {
                const element = allFormElements[i];
                // Keep all hidden inputs (like uploaded_pdf_name) and other form elements
                if (element.type !== 'file' && element.name) {
                    if (element.type === 'checkbox' || element.type === 'radio') {
                        if (element.checked) {
                            formData.append(element.name, element.value);
                        }
                    } else {
                        formData.append(element.name, element.value);
                    }
                }
            }

            const xhr = new XMLHttpRequest();
            xhr.open("POST", form.action, true);

            // Add CSRF protection
            const csrftoken = getCookie('csrftoken');
            if (csrftoken) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }

            let startTime = Date.now();

            xhr.upload.addEventListener("loadstart", function() {
                if (progressContainer) {
                    progressContainer.style.display = "block";
                    progressBar.value = 0;
                    uploadStatus.textContent = "Starting upload...";
                }
            });

            xhr.upload.addEventListener("progress", function(e) {
                if (e.lengthComputable && progressBar) {
                    const percent = (e.loaded / e.total) * 100;
                    progressBar.value = percent;

                    const elapsed = (Date.now() - startTime) / 1000;
                    const speed = (e.loaded / 1024 / 1024 / elapsed).toFixed(2);
                    const uploadedMB = (e.loaded / 1024 / 1024).toFixed(2);
                    const totalMB = (e.total / 1024 / 1024).toFixed(2);

                    uploadStatus.textContent =
                        `Uploading... ${uploadedMB}MB / ${totalMB}MB (${percent.toFixed(0)}%) at ${speed} MB/s`;
                }
            });

            xhr.onload = function() {
                if (xhr.status === 200) {
                    if (progressBar) {
                        progressBar.value = 100;
                        uploadStatus.textContent = "Upload complete! Processing...";
                    }
                    
                    // Replace the current history entry to prevent resubmission
                    if (window.history.replaceState) {
                        window.history.replaceState(null, null, window.location.href);
                    }
                    
                    // Redirect to refresh the page and show results
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    if (uploadStatus) uploadStatus.textContent = "Error uploading file.";
                    // Show error message from server if available
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) {
                            errorMessage.textContent = response.error;
                        }
                    } catch (e) {
                        errorMessage.textContent = "Server error occurred.";
                    }
                }
            };

            xhr.onerror = function() {
                if (uploadStatus) uploadStatus.textContent = "Network error occurred.";
                errorMessage.textContent = "Network error. Please check your connection.";
            };

            xhr.send(formData);
        });
    }

    // ---------------- DRAG & DROP ----------------
    const dropArea = document.getElementById('drop-area');
    if (dropArea && fileInput) {
        dropArea.addEventListener('click', function(e) {
            if (e.target !== fileInput && e.target.tagName !== 'LABEL') {
                fileInput.click();
            }
        });

        dropArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropArea.classList.add('drag-over');
        });

        dropArea.addEventListener('dragleave', function() {
            dropArea.classList.remove('drag-over');
        });

        dropArea.addEventListener('drop', function(e) {
            e.preventDefault();
            dropArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;

                const file = fileInput.files[0];
                let isValid = false;
                if (pdfAllowedExtensions.includes(file.name.split(".").pop().toLowerCase())) {
                    isValid = validatePDFFile(file);
                } else {
                    isValid = validateImageFile(file);
                }

                if (!isValid) {
                    fileInput.value = "";
                    return;
                }

                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        });
    }

    // ---------------- ASPECT RATIO FUNCTIONALITY ----------------
    initializeAspectRatio();
});

// ---------- ASPECT RATIO FUNCTIONS (UNCHANGED) ----------
let aspectRatio = 1;
let isAspectRatioLocked = false;
let originalWidth = 0;
let originalHeight = 0;

function limitDigitsAndRange(input) {
    input.value = input.value.replace(/[^0-9]/g, "");
    if (input.value.length > 5) input.value = input.value.slice(0, 5);

    let val = parseInt(input.value || 0);
    if (val > 20000) val = 20000;
    if (val < 1 && input.value !== "") val = 1;

    input.value = val || "";
}

function setOriginalDimensions(width, height) {
    originalWidth = width;
    originalHeight = height;
    aspectRatio = width / height;
}

function toggleAspectRatioLock() {
    const widthInput = document.getElementById("width-input");
    const heightInput = document.getElementById("height-input");
    isAspectRatioLocked = document.getElementById("lock-aspect-ratio").checked;

    if (isAspectRatioLocked) {
        let w = parseInt(widthInput.value) || 0;
        let h = parseInt(heightInput.value) || 0;

        if (w && !h) heightInput.value = Math.round(w / aspectRatio);
        else if (!w && h) widthInput.value = Math.round(h * aspectRatio);
        else if (w && h) heightInput.value = Math.round(w / aspectRatio);
    }
}

function updateWidthHeightListeners() {
    const widthInput = document.getElementById("width-input");
    const heightInput = document.getElementById("height-input");
    if (!widthInput || !heightInput) return;

    widthInput.addEventListener("input", function() {
        limitDigitsAndRange(widthInput);
        if (isAspectRatioLocked && widthInput.value) {
            let newHeight = Math.round(parseInt(widthInput.value) / aspectRatio);
            heightInput.value = Math.max(1, Math.min(20000, newHeight));
        }
    });

    heightInput.addEventListener("input", function() {
        limitDigitsAndRange(heightInput);
        if (isAspectRatioLocked && heightInput.value) {
            let newWidth = Math.round(parseInt(heightInput.value) * aspectRatio);
            widthInput.value = Math.max(1, Math.min(20000, newWidth));
        }
    });
}

function initializeAspectRatio() {
    const container = document.querySelector('.aspect-ratio-toggle');
    if (container) {
        const width = parseInt(container.dataset.originalWidth);
        const height = parseInt(container.dataset.originalHeight);

        if (width && height) {
            setOriginalDimensions(width, height);

            const widthInput = document.getElementById('width-input');
            const heightInput = document.getElementById('height-input');

            if (widthInput && !widthInput.value) widthInput.value = width;
            if (heightInput && !heightInput.value) heightInput.value = height;
        }
    }

    updateWidthHeightListeners();
}




// File Expiry Timer

document.addEventListener("DOMContentLoaded", function () {
    const timers = document.querySelectorAll(".expiry-time");

    timers.forEach((timerEl, index) => {
        let minutes = parseInt(timerEl.dataset.minutes) || 10;
        let seconds = minutes * 60;

        // Find the matching download button (next one with class downloadBtn)
        const btn = document.querySelectorAll(".downloadBtn")[index];

        const countdown = setInterval(() => {
            let m = Math.floor(seconds / 60);
            let s = seconds % 60;

            timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;

            if (seconds <= 0) {
                clearInterval(countdown);
                btn.classList.add("disabled");
                btn.setAttribute("href", "#");
                btn.textContent = "Expired";
            }

            seconds--;
        }, 1000);
    });
});




