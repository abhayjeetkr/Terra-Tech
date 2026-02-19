const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");

let lastSpoken = "";
let isProcessing = false;

// 🎧 Create ONE audio context (don’t recreate every beep)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.onloadeddata = () => {
            statusText.innerText = "Camera running...";
            setInterval(captureFrame, 1200); // Smart interval
        };
    })
    .catch(err => {
        statusText.innerText = "Camera access denied.";
    });

function captureFrame() {
    if (isProcessing) return; // Skip if previous frame still processing
    isProcessing = true;

    // 🔥 Lower resolution before sending
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        let formData = new FormData();
        formData.append("frame", blob, "frame.jpg");

        fetch("https://perc-kfnw.onrender.com/detect", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => handleResults(data))
        .catch(err => console.log(err))
        .finally(() => {
            isProcessing = false;
        });

    }, "image/jpeg", 0.6); // Lower JPEG quality = faster upload
}

function handleResults(data) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "14px Arial"; // Faster text rendering

    let spokenMessage = "";
    let meaningfulObjectFound = false;

    const stairLikeObjects = ["bench", "chair", "couch", "dining table"];

    data.objects.forEach(obj => {
        let [x1, y1, x2, y2] = obj.box;
        let boxCenter = (x1 + x2) / 2;
        let screenCenter = canvas.width / 2;

        let direction = "center";
        if (boxCenter < screenCenter - canvas.width / 6) direction = "left";
        else if (boxCenter > screenCenter + canvas.width / 6) direction = "right";

        ctx.strokeStyle = "lime";
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = "lime";
        ctx.fillText(`${obj.label} (${obj.distance})`, x1, y1 - 5);

        meaningfulObjectFound = true;
        spokenMessage += `${obj.label} ${obj.distance} on your ${direction}. `;

        if (obj.distance === "Very Close") playBeep();

        if (stairLikeObjects.includes(obj.label.toLowerCase())) {
            spokenMessage += "Possible step or raised surface ahead. ";
        }
    });

    if (!meaningfulObjectFound) spokenMessage = "Clear path ahead.";

    if (data.texts.length > 0) {
        spokenMessage += "Text detected: " + data.texts.join(", ");
    }

    // 🔊 Speak only if message changed
    if (spokenMessage && spokenMessage !== lastSpoken) {
        speak(spokenMessage);
        lastSpoken = spokenMessage;
        console.log(spokenMessage);
    }
}

function speak(text) {
    speechSynthesis.cancel(); // 🔥 Stop queued speech (prevents lag)
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1.1;
    msg.pitch = 1;
    speechSynthesis.speak(msg);
}

function playBeep() {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
}


