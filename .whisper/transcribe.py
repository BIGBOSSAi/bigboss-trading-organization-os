import sys
import json
from faster_whisper import WhisperModel

audio = sys.argv[1]
model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

# int8 on CPU is the fast/light path for an 8GB no-GPU machine.
model = WhisperModel(model_size, device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, beam_size=1)
text = " ".join(segment.text for segment in segments).strip()

print(json.dumps({"text": text, "language": info.language}))
