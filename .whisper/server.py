import os
import json
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from faster_whisper import WhisperModel

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
PORT = int(os.environ.get("WHISPER_PORT", "8378"))

print(f"[whisper] loading model '{MODEL_SIZE}' on cpu/int8 ...", flush=True)
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print(f"[whisper] model loaded; listening on 127.0.0.1:{PORT}", flush=True)


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok", "model": MODEL_SIZE})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/transcribe":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        data = self.rfile.read(length)
        # Detect container: webm/matroska magic vs default wav.
        suffix = ".webm" if data[:4] == b"\x1aE\xdf\xa3" else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            handle.write(data)
            path = handle.name
        try:
            segments, info = model.transcribe(path, beam_size=1)
            text = " ".join(segment.text for segment in segments).strip()
            self._json(200, {"text": text, "language": info.language})
        except Exception as error:  # noqa: BLE001
            self._json(500, {"error": str(error)})
        finally:
            try:
                os.remove(path)
            except OSError:
                pass

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
