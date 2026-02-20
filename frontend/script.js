// VISION AI ASSIST CORE LOGIC

// 🎥 UI BINDINGS
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const camStatus = document.getElementById("camStatus");
const statusText = document.getElementById("statusText");
const aiTitle = document.getElementById("aiTitle");
const aiDesc = document.getElementById("aiDesc");
const distanceBadge = document.getElementById("distanceBadge");
const dangerFlash = document.getElementById("dangerFlash");
const voiceStatus = document.getElementById("voiceStatus");
const voiceWave = document.getElementById("voiceWave");

// Buttons
const startBtn = document.getElementById("startBtn");
const btnText = document.getElementById("btnText");
const scanBtn = document.getElementById("scanBtn");
const contrastBtn = document.getElementById("contrastBtn");
const textBtn = document.getElementById("textBtn");
const destinationInput = document.getElementById("destination");

let stream = null;
let detectInterval = null;
let lastSpoken = "";
let lastSpokenObj = "";      // 🤐 Identity Tracker
let lastSpokenPriority = 0;  // ⚠️ Escalation Tracker
let lastSpeechTime = 0;      // 🤫 Cooldown timer
let isDangerActive = false;
let isScanning = false;

// 🚀 START/STOP CAMERA TOGGLE
async function toggleCamera() {
    if (!stream) {
        // START
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            video.srcObject = stream;
            video.play();

            // UI Updates
            updateStatus("ACTIVE", "Scanning...", "var(--success)");
            btnText.innerText = "STOP DETECTION";
            startBtn.classList.add("active");

            speak("Vision System Online. Scanning environment.");

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                startDetection();
            };
        } catch (err) {
            alert("Camera Error: " + err.message);
        }
    } else {
        // STOP
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        clearInterval(detectInterval);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // UI Updates
        updateStatus("READY", "System Paused", "var(--text-muted)");
        btnText.innerText = "START DETECTION";
        startBtn.classList.remove("active");
        aiTitle.innerText = "System Paused";
        aiDesc.innerText = "Press Start to resume.";
        disableDangerMode();
        speak("System paused.");
    }
}

// 🕵️ DETECTION LOOP
function startDetection() {
    detectInterval = setInterval(() => {
        if (!stream) return;

        // Draw video to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to Blob and send to API
        canvas.toBlob((blob) => {
            if (!blob) return;

            const formData = new FormData();
            formData.append("image", blob);

            fetch("http://127.0.0.1:5000/detect", {
                method: "POST",
                body: formData
            })
                .then(res => res.json())
                .then(data => handleResponse(data))
                .catch(err => console.error("API Error:", err));
        }, "image/jpeg", 0.6);
    }, 3000); // Check every 3 seconds (reduces noise)
}

// 🧠 HANDLE AI RESPONSE
function handleResponse(data) {
    // Clear Overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (data.status !== "success") {
        console.error("Backend Error:", data.message);
        aiTitle.innerText = "Error";
        aiDesc.innerText = data.message;
        updateStatus("ERROR", "System Failure", "var(--danger)");
        return;
    }

    if (data.detections.length > 0) {
        const topObj = data.detections[0]; // Top Priority

        // Update Card
        aiTitle.innerText = topObj.object.toUpperCase();
        aiDesc.innerText = `Confidence: ${(topObj.confidence * 100).toFixed(0)}%`;
        distanceBadge.innerText = topObj.distance.toUpperCase();

        // Danger Check
        if (topObj.priority >= 3) {
            enableDangerMode();
            updateStatus("DANGER", "CRITICAL THREAT", "var(--danger)");
        } else {
            disableDangerMode();
            updateStatus("ACTIVE", "Scanning...", "var(--success)");
        }

        // Draw Boxes
        data.detections.forEach(obj => drawBox(obj.box, obj.priority));

    } else {
        aiTitle.innerText = "Scanning...";
        aiDesc.innerText = "No objects detected.";
        distanceBadge.innerText = "-- M";
        disableDangerMode();
    }

    // Voice Logic (STRICT MODE 🤐)
    const now = Date.now();
    const timeSinceLast = now - lastSpeechTime;

    // Get Top Object Info
    let currentObj = "";
    let currentPriority = 0;
    if (data.detections.length > 0) {
        currentObj = data.detections[0].object;
        currentPriority = data.detections[0].priority;
    }

    // CRITICAL KEYWORDS that ALWAYS bypass silence
    const isCritical = data.voice.includes("Stop") || data.voice.includes("FAST") || data.voice.includes("blocking");

    // DECISION TREE: Speak Only If...
    const isNewObject = currentObj !== lastSpokenObj;
    const isEscalation = currentPriority > lastSpokenPriority; // Safe -> Danger
    const isReminder = timeSinceLast > 10000; // 10s Timeout

    if (data.voice && (isNewObject || isEscalation || isCritical || isReminder)) {
        speak(data.voice);

        // Update State
        lastSpoken = data.voice;
        lastSpokenObj = currentObj;
        lastSpokenPriority = currentPriority;
        lastSpeechTime = now;

        animateVoice(true);
        setTimeout(() => animateVoice(false), 3000);
    }
}

// 🟥 DANGER MODE VISUALS
function enableDangerMode() {
    // Pulse Vibration (Happens every update)
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    if (isDangerActive) return; // Visuals already active
    isDangerActive = true;
    document.body.classList.add("danger-active");
    dangerFlash.style.opacity = "1";
}

function disableDangerMode() {
    if (!isDangerActive) return;
    isDangerActive = false;
    document.body.classList.remove("danger-active");
    dangerFlash.style.opacity = "0";
}

// 🎨 DRAW BOXES
function drawBox(box, priority) {
    const [x1, y1, x2, y2] = box;
    let color = "#00d4ff"; // Blue
    if (priority >= 3) color = "#ff004c"; // Red
    else if (priority === 2) color = "#d400ff"; // Purple

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
}

// 🔊 VOICE SYNTHESIS
function speak(text) {
    // Stop previous
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utter);
}

// 🌊 VOICE ANIMATION
function animateVoice(isActive) {
    if (isActive) {
        voiceStatus.innerText = "AI Speaking...";
        voiceWave.style.opacity = "1";
    } else {
        voiceStatus.innerText = "Listening...";
        voiceWave.style.opacity = "0.5";
    }
}

// 🧭 GPS & NAV
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            speak("Location found. Ready to navigate.");
            aiTitle.innerText = "GPS Fixed";
            aiDesc.innerText = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
        }, () => alert("GPS Permission Denied"));
    }
}

function getRoute() {
    const dest = destinationInput.value;
    if (dest) {
        speak(`Calculating route to ${dest}`);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, "_blank");
    } else {
        speak("Please enter a destination first.");
    }
}

function scanNow() {
    speak("Analyzing scene...");
    // Future: Trigger explicit detailed analysis
}

// ♿ ACCESSIBILITY TOGGLES
contrastBtn.onclick = () => {
    document.body.classList.toggle("high-contrast");
    speak("High contrast mode toggled.");
};

textBtn.onclick = () => {
    document.body.classList.toggle("large-text");
    speak("Large text mode toggled.");
};

// 🔄 SYSTEM STATUS UI
function updateStatus(text, desc, color) {
    statusText.innerText = text;
    camStatus.querySelector(".dot").style.background = color;
    camStatus.querySelector(".dot").style.boxShadow = `0 0 10px ${color}`;
}

// 🎤 VOICE AGENT LOGIC
const micBtn = document.getElementById("micBtn");
let latestData = null; // Store for voice queries
let targetObject = null; // 🔍 Find Mode Target

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
        animateVoice(true);
        micBtn.classList.add("active");
        speak("I'm listening.");
    };

    recognition.onend = () => {
        animateVoice(false);
        micBtn.classList.remove("active");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log("Voice Command:", transcript);
        processCommand(transcript);
    };
} else {
    alert("Voice Assistant not supported in this browser.");
    micBtn.style.display = "none";
}

function toggleVoice() {
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            recognition.stop();
        }
    }
}

function processCommand(cmd) {
    // 🌍 NAVIGATION COMMAND
    if (cmd.includes("navigate to")) {
        const destination = cmd.split("navigate to")[1].trim();
        if (destination) {
            speak(`Starting walking directions to ${destination}. Switching to Outdoor Safety Mode.`);

            // 1. Open Maps
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`, '_blank');

            // 2. Enable Outdoor Mode
            fetch('http://127.0.0.1:5000/toggle_outdoor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: true })
            });
            return;
        }
    }

    // 🔍 FIND MODE
    if (cmd.startsWith("find")) {
        const obj = cmd.replace("find", "").replace("my", "").trim();
        if (obj.length > 0) {
            targetObject = obj;
            speak(`Okay, I am looking for ${targetObject}. Scan the room.`);
        } else {
            speak("What should I find?");
        }
    }
    // 🛑 STOP FINDING
    else if (cmd.includes("stop finding") || cmd.includes("cancel")) {
        targetObject = null;
        speak("Stopped looking.");
    }
    // ⌚ UTILITIES
    else if (cmd.includes("time")) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        speak(`It is ${time}`);
    }
    else if (cmd.includes("date") || cmd.includes("day")) {
        const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        speak(`Today is ${date}`);
    }
    // 👁️ VISION QUERIES
    else if (cmd.includes("what is in front") || cmd.includes("what do you see")) {
        if (!latestData || latestData.detections.length === 0) {
            speak("I don't see anything right now.");
        } else {
            const summary = latestData.summary || "nothing specific";
            speak(`Currently, I see ${summary}. The closest items are ${latestData.detections.slice(0, 2).map(d => d.object + ' at ' + d.clock_dir).join(" and ")}.`);
        }
    }
    // 🚶‍♂️ MOVEMENT ADVICE (Should I move? Is it safe?)
    else if (cmd.includes("move") || cmd.includes("walk") || cmd.includes("can i go") || cmd.includes("safe")) {
        if (!latestData) {
            speak("I'm still analyzing your surroundings. Give me a moment.");
            return;
        }

        if (latestData.is_dark) {
            speak("It's too dark for me to see clearly. For your safety, please turn on a light before moving.");
            return;
        }

        if (latestData.detections.length === 0) {
            speak("Yes, the path ahead looks completely clear. You can walk forward safely.");
        } else {
            const topObj = latestData.detections[0];
            const dist = parseFloat(topObj.distance.replace('m', ''));
            const movement = topObj.move_state || "static";

            if (topObj.priority >= 3 || dist < 1.5 || movement.includes("Approaching")) {
                let reason = `There is a ${topObj.object} `;
                if (movement.includes("Approaching")) reason += "coming towards you ";
                reason += `at ${topObj.clock_dir}, only ${topObj.distance} away.`;
                speak(`I recommend staying still. ${reason} Better to wait until it's clear.`);
            } else {
                speak(`It seems safe to move slowly. The nearest obstacle is a ${topObj.object} at ${topObj.clock_dir}, but it's ${topObj.distance} away.`);
            }
        }
    }
    // 🧭 DIRECTIONAL GUIDANCE (Which way is clear?)
    else if (cmd.includes("clear") || cmd.includes("which way") || cmd.includes("direction")) {
        if (!latestData || latestData.detections.length === 0) {
            speak("The entire path ahead is clear. You can go any way you like.");
        } else {
            const occupied = latestData.detections.map(d => d.clock_dir);
            const sectors = ["10 o'clock", "11 o'clock", "12 o'clock", "1 o'clock", "2 o'clock"];
            const free = sectors.filter(s => !occupied.includes(s));

            if (free.length > 0) {
                if (free.includes("12 o'clock")) {
                    speak("The path straight ahead at 12 o'clock is clear. That's your best way.");
                } else {
                    speak(`12 o'clock is partially blocked, but it looks clear at ${free.join(" and ")}. You could try turning that way.`);
                }
            } else {
                speak("It looks quite crowded in all directions. I suggest waiting for a moment for someone to pass.");
            }
        }
    }
    else if (cmd.includes("where am i")) {
        getLocation();
    }
    else if (cmd.includes("hello")) {
        speak("Hello! I am your Vision Assistant. Ask me what I see.");
    }
    else {
        speak("I didn't quite get that. You can ask 'Find keys', 'What detected', or 'Time'.");
    }
}

// 🔍 CHECK TARGET IN FEED
function checkTarget(data) {
    if (targetObject && data.detections) {
        const found = data.detections.find(d => d.object.includes(targetObject) || targetObject.includes(d.object));
        if (found) {
            speak(`Found ${found.object}! ${found.distance} ahead.`);
            targetObject = null; // Reset after finding
        }
    }
}

// Update latestData in handleResponse
const originalHandleResponse = handleResponse;
handleResponse = function (data) {
    latestData = data; // Catch latest frame data
    checkTarget(data); // 🔍 Check for specific items
    originalHandleResponse(data);
};
