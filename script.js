const apiKeyInput = document.getElementById('apiKeyInput');
const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('imagePreview');
const generateButton = document.getElementById('generateButton');
const resultsContainer = document.getElementById('resultsContainer');
const descriptionOutput = document.getElementById('descriptionOutput');
const negativePromptOutput = document.getElementById('negativePromptOutput');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const customFileUpload = document.querySelector('.custom-file-upload');
const customFileText = customFileUpload.querySelector('.font-semibold');

let base64ImageData = null;

function showResults() {
    resultsContainer.style.display = 'block';
    setTimeout(() => {
        resultsContainer.classList.add('visible');
    }, 10);
}

function hideResults() {
    resultsContainer.classList.remove('visible');
    setTimeout(() => {
        if (!resultsContainer.classList.contains('visible')) {
            resultsContainer.style.display = 'none';
        }
    }, 500);
}

imageUpload.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        errorMessage.style.display = 'none';
        customFileText.textContent = file.name;

        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            base64ImageData = e.target.result.split(',')[1];
            generateButton.disabled = apiKeyInput.value.trim() === '';
            hideResults();
        };
        reader.onerror = function() {
            errorMessage.textContent = 'Gagal membaca file gambar.';
            errorMessage.style.display = 'block';
            generateButton.disabled = true;
            imagePreview.style.display = 'none';
            customFileText.textContent = 'Tarik & Lepas atau Klik untuk Mengunggah';
        };
        reader.readAsDataURL(file);
    } else {
        generateButton.disabled = true;
        imagePreview.style.display = 'none';
        hideResults();
        customFileText.textContent = 'Tarik & Lepas atau Klik untuk Mengunggah';
    }
});

apiKeyInput.addEventListener('input', function() {
    generateButton.disabled = apiKeyInput.value.trim() === '' || !base64ImageData;
});

generateButton.addEventListener('click', async function() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        errorMessage.textContent = 'Silakan masukkan Gemini API Key Anda.';
        errorMessage.style.display = 'block';
        return;
    }

    if (!base64ImageData) {
        errorMessage.textContent = 'Silakan unggah gambar terlebih dahulu.';
        errorMessage.style.display = 'block';
        return;
    }

    errorMessage.style.display = 'none';
    hideResults();
    loadingSpinner.style.display = 'block';
    generateButton.disabled = true;

    try {
        const prompt = `You are an expert prompt creator for Kling AI's image-to-video feature. Your task is to analyze the provided static image and generate a JSON object containing two keys: "positivePrompt" and "negativePrompt".

1.  **For "positivePrompt"**: Generate a concise video prompt in English that describes ONLY the animation and camera movement to be applied. Do NOT describe what is already in the image.
2.  **For "negativePrompt"**: Analyze the image content and style. Generate a comma-separated string of relevant negative prompts in English to prevent unwanted elements or styles. For example, if the image is a photograph, suggest "illustration, cartoon, anime, 3d". If the image contains text, suggest "text, watermark, logo". If it is high quality, suggest "blurry, low quality, noisy". Only suggest relevant negative prompts based on the input image.

Your final output MUST be a valid JSON object. Example output:
{
  "positivePrompt": "The car accelerates forward, its wheels spinning, with the camera tracking alongside it.",
  "negativePrompt": "cartoon, painting, illustration, 3d, blurry, low quality"
}

Now, analyze the following image and generate the JSON object.`;

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: imageUpload.files[0].type,
                                data: base64ImageData
                            }
                        }
                    ]
                }
            ],
        };
        
        // Using a more flexible model, like gemini-1.5-flash
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorDetail = await response.json();
            const errorMessageText = errorDetail?.error?.message ?? `HTTP Error ${response.status}`;
            throw new Error(`API Error: ${errorMessageText}`);
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            let text = result.candidates[0].content.parts[0].text;
            try {
                // Clean the text response from the API
                const jsonString = text.match(/\{[\s\S]*\}/);
                if (!jsonString) {
                    throw new Error("No valid JSON object found in the API response.");
                }
                const parsedJson = JSON.parse(jsonString[0]);

                if(parsedJson.positivePrompt && parsedJson.negativePrompt) {
                    descriptionOutput.textContent = parsedJson.positivePrompt;
                    negativePromptOutput.textContent = parsedJson.negativePrompt;
                    showResults();
                } else {
                     throw new Error("Invalid JSON structure from API. Missing required keys.");
                }
            } catch (e) {
                 console.error("JSON Parsing Error: ", e);
                 descriptionOutput.textContent = text; // Show raw text if parsing fails
                 negativePromptOutput.textContent = "Gagal membuat saran negative prompt (Format respons tidak valid).";
                 showResults();
            }
        } else {
            throw new Error('Tidak dapat menghasilkan prompt untuk gambar ini. Coba gambar lain atau periksa API Key Anda.');
        }

    } catch (error) {
        console.error('Error generating prompt:', error);
        errorMessage.textContent = `Terjadi kesalahan: ${error.message || 'Gagal menghasilkan prompt.'}`;
        errorMessage.style.display = 'block';
    } finally {
        loadingSpinner.style.display = 'none';
        generateButton.disabled = apiKeyInput.value.trim() === '' || !base64ImageData;
    }
}); 