from flask import Flask, jsonify
import whisper
from transformers import BartTokenizer, BartForConditionalGeneration
from flask_cors import CORS
import os
import torch
app = Flask(__name__)
CORS(app)

# # Load BART for summarization
# bart_model_name = "facebook/bart-large-cnn"
# bart_tokenizer = BartTokenizer.from_pretrained(bart_model_name)
# bart_model = BartForConditionalGeneration.from_pretrained(bart_model_name)


from transformers import LEDTokenizer, LEDForConditionalGeneration

model_name = "allenai/led-base-16384"
led_tokenizer = LEDTokenizer.from_pretrained(model_name)
model = LEDForConditionalGeneration.from_pretrained(model_name)




# Load Whisper for transcription
whisper_model = whisper.load_model("base")

AUDIO_DIR = "../server/src/lib/public/recordings"
EXTENSIONS = (".wav", ".mp3", ".m4a", ".flac", ".aac", ".ogg")

@app.route('/summary', methods=['GET'])
def transcribe_folder():
    transcripts = []
    for root, _, files in os.walk(AUDIO_DIR):
        for fname in files:
            if fname.lower().endswith(EXTENSIONS):
                path = os.path.join(root, fname)
                app.logger.info(f"⏳ Transcribing {fname}…")
                result = whisper_model.transcribe(path, language="english")
                text = result.get("text", "").strip()
                transcripts.append(text)
    print(f'Transcript: {transcripts}')
    full_text = " ".join(transcripts)

    # Tokenize and summarize using BART
    # inputs = bart_tokenizer([full_text], max_length=1024, return_tensors="pt", truncation=True)
    # summary_ids = bart_model.generate(inputs["input_ids"], max_length=200, min_length=50, length_penalty=2.0, num_beams=4, early_stopping=True)
    # summary = bart_tokenizer.decode(summary_ids[0], skip_special_tokens=True)


    inputs = led_tokenizer(
    text,
    return_tensors="pt",
    padding="max_length",
    truncation=True,
    max_length=16384
    )
    global_attention_mask = torch.zeros_like(inputs["input_ids"])
    global_attention_mask[:, 0] = 1  # global attention on [CLS] token
    summary_ids = model.generate(
    input_ids=inputs["input_ids"],
    attention_mask=inputs["attention_mask"],
    global_attention_mask=global_attention_mask,
    max_length=512,
    num_beams=4
    )

    summary = led_tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    print(summary)


    return jsonify({"summary": summary})

if __name__ == '__main__':
    app.run(debug=True)
