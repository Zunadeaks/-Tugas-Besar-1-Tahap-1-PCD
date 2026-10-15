"""Puzzle Studio — server lokal Python + Pillow, tanpa framework web."""
import base64
import io
import json
import random
import webbrowser
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
Image.MAX_IMAGE_PIXELS = 25_000_000

def png(image):
    out = io.BytesIO()
    image.save(out, 'PNG')
    return out.getvalue()

def generate(raw, m=3, rotate=False, grayscale=False):
    """M x M potongan tengah; grid keseluruhan (M+2) x (M+2)."""
    if type(m) is not int or m != 3:
        raise ValueError('Grid puzzle hanya tersedia 3 × 3.')
    with Image.open(io.BytesIO(raw)) as source:
        source.load()
        image = ImageOps.exif_transpose(source).convert('L' if grayscale or source.mode in ('1', 'L', 'I', 'F') else 'RGB')
    w, h = image.size
    g = m + 2
    if min(w, h) < g:
        raise ValueError(f'Ukuran gambar minimal {g} × {g} piksel.')
    # Batas pembagian integer mencakup semua piksel, tanpa resize atau crop.
    xs = [i * w // g for i in range(g + 1)]
    ys = [i * h // g for i in range(g + 1)]
    frame = image.copy()
    draw = ImageDraw.Draw(frame)
    fill, line = (237, 180) if image.mode == 'L' else ((237, 241, 248), (174, 185, 205))
    draw.rectangle((xs[1], ys[1], xs[-2]-1, ys[-2]-1), fill=fill)
    pieces, metadata = [], []
    for r in range(m):
        for c in range(m):
            box = (xs[c+1], ys[r+1], xs[c+2], ys[r+2])
            piece = image.crop(box)
            angle = random.choice([0, 90, 180, 270]) if rotate else 0
            if angle:
                piece = piece.rotate(angle, expand=True)
            name = f'pieces/piece_{r+1:02d}_{c+1:02d}.png'
            pieces.append((name, png(piece)))
            metadata.append(dict(file=name, row=r+1, column=c+1, box=list(box), rotation_ccw=angle))
            draw.rectangle((box[0], box[1], box[2]-1, box[3]-1), outline=line, width=1)
    manifest = dict(width=w, height=h, mode=image.mode, puzzle_grid=m, full_grid=g, count=m*m,
                    note='row/column mulai 1. box: left, top, right, bottom; right/bottom eksklusif. Putar kembali -rotation_ccw sebelum menyusun.', pieces=metadata)
    frame_bytes = png(frame)
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('frame.png', frame_bytes)
        for name, data in pieces:
            z.writestr(name, data)
        z.writestr('metadata.json', json.dumps(manifest, indent=2))
    enc = lambda data: base64.b64encode(data).decode('ascii')
    return dict(frame=enc(frame_bytes), pieces=[dict(name=n.split('/')[-1], data=enc(d)) for n,d in pieces],
                archive=enc(out.getvalue()), info=manifest)

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/generate':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 21_000_000:
                raise ValueError('Berkas terlalu besar. Maksimal gambar 15 MB.')
            data = json.loads(self.rfile.read(length))
            raw = base64.b64decode(data['image'], validate=True)
            if len(raw) > 15_000_000:
                raise ValueError('Maksimal gambar 15 MB.')
            result = generate(raw, data.get('m', 3), bool(data.get('rotate')), bool(data.get('grayscale')))
            self.respond(200, result)
        except (ValueError, KeyError, UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            self.respond(400, {'error': 'Gambar tidak valid atau terlalu besar.' if not isinstance(exc, ValueError) else str(exc)})
        except Exception:
            self.respond(500, {'error': 'Proses gagal. Coba gambar lain.'})
    def respond(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8000), partial(Handler, directory=str(ROOT / 'static')))
    print('Puzzle Studio: http://127.0.0.1:8000 | Hentikan dengan Ctrl+C')
    webbrowser.open('http://127.0.0.1:8000')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer dihentikan.')
    finally:
        server.server_close()
