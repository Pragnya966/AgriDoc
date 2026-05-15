
let model;

const diseaseInfo = {
  Bacterial_Spot: {
    en: {
      title: "Bacterial Spot",
      desc: "Small dark water-soaked spots suggest bacterial spot on tomato leaves.",
      treatment: [
        "Remove badly infected leaves and keep them away from the field.",
        "Avoid overhead watering because wet leaves help bacteria spread.",
        "Use copper-based bactericide only as recommended by a local agriculture officer."
      ],
      prevention: "Use disease-free seed, rotate crops, and keep enough spacing for airflow."
    },
    te: {
      title: "Bacterial Spot",
      desc: "Tomato leaf lo bacterial spot symptoms kanipistunnayi.",
      treatment: [
        "Ekkuva infection unna akulu teesesi field ki dooranga pettandi.",
        "Akula pai neeru padakunda drip watering vadandi.",
        "Local agriculture officer salahatho copper-based spray vadandi."
      ],
      prevention: "Healthy seed vadandi, crop rotation cheyyandi, plants madhya airflow undela spacing ivvandi."
    }
  },
  Early_Blight: {
    en: {
      title: "Early Blight",
      desc: "Ring-like brown spots suggest early blight on tomato leaves.",
      treatment: [
        "Remove infected lower leaves first.",
        "Apply a suitable fungicide after checking local crop guidance.",
        "Mulch the soil to reduce spores splashing onto leaves."
      ],
      prevention: "Water at the base, rotate crops, and avoid leaving infected plant debris in the field."
    },
    te: {
      title: "Early Blight",
      desc: "Tomato leaf pai ring laga brown spots early blight ni chupistunnayi.",
      treatment: [
        "Munduga infected lower leaves teeseyandi.",
        "Local crop guidance prakaram suitable fungicide vadandi.",
        "Soil nundi spores akula pai padakunda mulching cheyyandi."
      ],
      prevention: "Base daggara water cheyyandi, crop rotation follow avvandi, infected debris field lo vadalakandi."
    }
  },
  Healthy: {
    en: {
      title: "Healthy Leaf",
      desc: "The uploaded leaf looks healthy based on the model result.",
      treatment: [
        "No disease treatment is needed right now.",
        "Continue regular monitoring.",
        "Keep watering and nutrition consistent."
      ],
      prevention: "Check plants every few days so any new symptoms are caught early."
    },
    te: {
      title: "Healthy Leaf",
      desc: "Model result prakaram leaf healthy ga kanipistundi.",
      treatment: [
        "Ippudu disease treatment avasaram ledu.",
        "Regular monitoring continue cheyyandi.",
        "Watering mariyu nutrition consistent ga maintain cheyyandi."
      ],
      prevention: "Kotha symptoms early ga telusukodaniki konni rojula ki okasari plants check cheyyandi."
    }
  },

  Leaf_Mold: {
    en: {
      title: "Leaf Mold",
      desc: "Pale patches with moldy growth suggest tomato leaf mold.",
      treatment: [
        "Improve ventilation around plants.",
        "Remove infected leaves carefully.",
        "Use a recommended fungicide if the disease keeps spreading."
      ],
      prevention: "Reduce humidity, avoid crowding, and water early in the day."
    },
    te: {
      title: "Leaf Mold",
      desc: "Pale patches mariyu mold growth tomato leaf mold symptoms laga unnayi.",
      treatment: [
        "Plants chuttu ventilation improve cheyyandi.",
        "Infected leaves jagrathaga teeseyandi.",
        "Disease spread aithe recommended fungicide vadandi."
      ],
      prevention: "Humidity tagginchandi, plants crowd avvakunda chudandi, morning lo water cheyyandi."
    }
  },
  Septoria: {
    en: {
      title: "Septoria Leaf Spot",
      desc: "Many small circular spots suggest Septoria leaf spot.",
      treatment: [
        "Remove spotted leaves and dispose of them safely.",
        "Keep foliage dry as much as possible.",
        "Use a protective fungicide when advised by an expert."
      ],
      prevention: "Do not work with plants when leaves are wet, and rotate tomato crops each season."
    },
    te: {
      title: "Septoria Leaf Spot",
      desc: "Chinna circular spots ekkuvaga unte Septoria leaf spot avvachu.",
      treatment: [
        "Spots unna leaves teesesi safe ga dispose cheyyandi.",
        "Akulu dry ga undela chudandi.",
        "Expert salahatho protective fungicide vadandi."
      ],
      prevention: "Akulu wet ga unnappudu plants handle cheyyakandi, prathi season tomato crop rotate cheyyandi."
    }
  },
  
};

async function loadModel() {
  const detectBtn = document.getElementById("detectBtn");
  if (detectBtn) detectBtn.disabled = true;

  try {
    model = await tf.loadGraphModel("model/model.json");
    console.log("Model loaded");
  } catch (err) {
    console.error("Model load failed:", err);
    showResult(`
      <div class="result-content">
        <div class="result-icon">!</div>
        <h3>Model Load Failed</h3>
        <p>Please run this project from a local server and check the model folder.</p>
      </div>
    `);
  } finally {
    if (detectBtn) detectBtn.disabled = false;
  }
}

window.addEventListener("DOMContentLoaded", loadModel);

async function predict() {
  const lang = document.getElementById("language").value;
  const file = document.getElementById("imageInput").files[0];

  if (!file) {
    alert("Please upload an image first");
    return;
  }

  if (!model) {
    alert("Model not loaded yet. Wait a moment.");
    return;
  }

  showResult(`
    <div class="result-content">
      <div class="result-icon">...</div>
      <h3>Analyzing...</h3>
      <p>Please wait while AI checks the leaf</p>
    </div>
  `);

  const img = document.getElementById("previewImg");
  if (!img.complete) {
    await new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }

  let tensor;
  let prediction;

  try {
    tensor = tf.browser.fromPixels(img)
      .resizeBilinear([224, 224])
      .toFloat()
      .div(255.0)
      .expandDims();

    prediction = model.execute(
      { [model.inputs[0].name]: tensor },
      model.outputs[0].name
    );

    if (Array.isArray(prediction)) {
      prediction = prediction[0];
    }

    const probs = Array.from(prediction.dataSync());
    if (probs.some(Number.isNaN)) {
      throw new Error("NaN in prediction");
    }

    const maxIndex = probs.indexOf(Math.max(...probs));
    const diseases = ["Bacterial_Spot", "Early_Blight", "Leaf_Mold", "Septoria", "Healthy"];
    const disease = diseases[maxIndex];
    const confidence = (probs[maxIndex] * 100).toFixed(2);
    const fallbackAdvice = getDiseaseAdvice(disease, lang);
    renderDiagnosis(fallbackAdvice, confidence, lang, true);

    const aiResult = await fetchAiAdvice(disease, confidence, lang);
    if (aiResult.advice) {
      renderDiagnosis(aiResult.advice, confidence, lang, false);
    } else {
      setAdviceStatus(`Live AI advice is unavailable: ${aiResult.error}. Showing built-in crop guidance.`);
    }
  } catch (err) {
    console.error("Prediction error:", err);
    showResult(`
      <div class="result-content">
        <div class="result-icon">x</div>
        <h3>Error</h3>
        <p>Prediction failed. Check the browser console.</p>
      </div>
    `);
  } finally {
    if (tensor) tensor.dispose();
    if (prediction && prediction.dispose) prediction.dispose();
  }
}

function getDiseaseAdvice(disease, lang) {
  const selectedLang = diseaseInfo[disease]?.[lang] ? lang : "en";
  return diseaseInfo[disease][selectedLang];
}

async function fetchAiAdvice(disease, confidence, lang) {
  try {
    const response = await fetch("/api/advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        disease,
        confidence,
        language: lang
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.warn("AI advice unavailable:", error.error || response.statusText);
      return { advice: null, error: error.error || response.statusText };
    }

    const data = await response.json();
    return {
      advice: {
        title: data.title || disease,
        desc: data.summary || data.desc || `Detected disease: ${disease}`,
        treatment: Array.isArray(data.actions) ? data.actions.slice(0, 3) : [],
        prevention: data.prevention || "",
        warning: data.warning || ""
      },
      error: null
    };
  } catch (err) {
    console.warn("AI advice request failed:", err);
    return { advice: null, error: err.message || "request failed" };
  }
}

function renderDiagnosis(advice, confidence, lang, isLoadingAiAdvice) {
  const treatmentItems = advice.treatment.map(item => `<li>${item}</li>`).join("");
  const aiStatus = isLoadingAiAdvice
    ? `<p id="aiAdviceStatus" class="ai-advice-status">Getting live AI treatment advice...</p>`
    : `<p id="aiAdviceStatus" class="ai-advice-status">Live AI treatment advice generated.</p>`;
  const warning = advice.warning ? `<p><strong>Note:</strong> ${advice.warning}</p>` : "";

  showResult(`
    <div class="result-content">
      <div class="result-icon">AI</div>
      <h3>${advice.title}</h3>
      <p>${advice.desc}</p>
      <p><strong>Confidence:</strong> ${confidence}%</p>
      ${aiStatus}
      <h4>Recommended Action</h4>
      <ul class="ai-advice-list">${treatmentItems}</ul>
      <p><strong>Prevention:</strong> ${advice.prevention}</p>
      ${warning}
      <button onclick="speakResult()">Listen</button>
    </div>
  `);

  window.currentText = [
    advice.title,
    advice.desc,
    `Confidence ${confidence} percent.`,
    "Recommended action.",
    ...advice.treatment,
    `Prevention. ${advice.prevention}`
  ].join(" ");
  window.currentLang = lang;
}

function setAdviceStatus(message) {
  const statusEl = document.getElementById("aiAdviceStatus");
  if (statusEl) statusEl.textContent = message;
}

function showResult(html) {
  const resultEl = document.getElementById("result");
  if (resultEl) resultEl.innerHTML = html;
}

function speakResult() {
  if (!window.currentText) return;
  speak(window.currentText, window.currentLang);
}

function speak(text, lang) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = lang === "te" ? "te-IN" : "en-IN";

  function setVoiceAndSpeak() {
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.lang === msg.lang)
      || voices.find(voice => voice.lang.startsWith(lang))
      || voices.find(voice => voice.lang.startsWith("en"));

    if (preferredVoice) msg.voice = preferredVoice;
    speechSynthesis.cancel();
    speechSynthesis.speak(msg);
  }

  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
  } else {
    setVoiceAndSpeak();
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then(() => console.log("Service worker registered"))
    .catch(err => console.warn("Service worker registration failed:", err));
}
