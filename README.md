# AgriDoctor

AI-powered tomato leaf disease detection using a local TensorFlow.js model, with optional treatment advice from Gemini.

## Run with Gemini API

1. Create a Gemini API key in Google AI Studio:

```text
https://aistudio.google.com/app/apikey
```

2. Open PowerShell in this folder and run:

```powershell
$env:GEMINI_API_KEY="your_gemini_api_key_here"
node server.js
```

3. Open:

```text
http://localhost:8080
```

The default Gemini model is:

```text
gemini-2.5-flash
```

## Deploy

Recommended beginner path: deploy this as a Node.js web service on Render or Railway.

### Files that must be deployed

Keep these:

```text
app.js
index.html
manifest.json
model/
package.json
server.js
service-worker.js
style.css
```

Do not deploy these large/local training files:

```text
dataset/
model.h5
tfjs_env/
```

### Render

1. Push the project to GitHub.
2. Create a new Render Web Service from the GitHub repo.
3. Use these settings:

```text
Build Command: npm install
Start Command: npm start
```

4. Add this environment variable in Render:

```text
GEMINI_API_KEY=your_gemini_api_key_here
```

5. Deploy and open the Render URL.

### Railway

1. Push the project to GitHub.
2. Create a Railway project from the GitHub repo.
3. Add this environment variable:

```text
GEMINI_API_KEY=your_gemini_api_key_here
```

4. Railway should run:

```text
npm start
```

## Optional settings

Use another app port:

```powershell
$env:PORT="8090"
node server.js
```

Use another Gemini model:

```powershell
$env:GEMINI_MODEL="gemini-2.0-flash"
node server.js
```

## Optional Ollama mode

```powershell
$env:AI_PROVIDER="ollama"
$env:OLLAMA_MODEL="llama3.2"
node server.js
```

## Optional OpenAI mode

OpenAI can cost money:

```powershell
$env:AI_PROVIDER="openai"
$env:OPENAI_API_KEY="your_openai_api_key_here"
node server.js
```

## Run without API advice

The TensorFlow.js disease detector still works without Gemini. If Gemini is not configured, the app shows built-in crop guidance.
