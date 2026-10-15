
import os
import cv2
import numpy as np
import matplotlib.pyplot as plt
from tkinter import Tk, filedialog

M = 5  # Puzzle berukuran 5 x 5


# Memilih gambar dari komputer
def pilih_gambar():
    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    path = filedialog.askopenfilename(
        title="Pilih Gambar Puzzle",
        filetypes=[("Gambar", "*.png *.jpg *.jpeg *.bmp *.tif *.tiff")]
    )
    root.destroy()
    return path


# Membaca gambar RGB atau grayscale
def baca_gambar(path):
    gambar = cv2.imread(path, cv2.IMREAD_UNCHANGED)

    if gambar is None:
        raise ValueError("Gambar tidak dapat dibaca.")

    if gambar.ndim == 3 and gambar.shape[2] == 4:
        gambar = cv2.cvtColor(gambar, cv2.COLOR_BGRA2BGR)

    return gambar


# Membuat frame kosong dengan grid 5 x 5
def buat_frame(tinggi, lebar, shape):
    if len(shape) == 2:
        frame = np.full((tinggi, lebar), 255, dtype=np.uint8)
        warna = 0
    else:
        frame = np.full((tinggi, lebar, 3), 255, dtype=np.uint8)
        warna = (0, 0, 0)

    for i in range(M + 1):
        x = min(round(i * lebar / M), lebar - 1)
        y = min(round(i * tinggi / M), tinggi - 1)

        cv2.line(frame, (x, 0), (x, tinggi - 1), warna, 2)
        cv2.line(frame, (0, y), (lebar - 1, y), warna, 2)

    return frame


# Memotong gambar menjadi 25 potongan
def potong_gambar(gambar, folder):
    tinggi, lebar = gambar.shape[:2]
    potongan = []
    nomor = 1

    for baris in range(M):
        y1 = round(baris * tinggi / M)
        y2 = round((baris + 1) * tinggi / M)

        for kolom in range(M):
            x1 = round(kolom * lebar / M)
            x2 = round((kolom + 1) * lebar / M)

            bagian = gambar[y1:y2, x1:x2].copy()
            nama = os.path.join(folder, f"piece_{nomor:02d}.png")

            if not cv2.imwrite(nama, bagian):
                raise IOError(f"Gagal menyimpan {nama}")

            potongan.append(bagian)
            nomor += 1

    return potongan


# Menampilkan hasil
def tampilkan_hasil(gambar, frame, potongan):
    def konversi(img):
        if img.ndim == 3 and img.shape[2] == 3:
            return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    axes[0].imshow(
        konversi(gambar),
        cmap="gray" if gambar.ndim == 2 else None
    )
    axes[0].set_title("Gambar Asli")
    axes[0].axis("off")

    axes[1].imshow(
        konversi(frame),
        cmap="gray" if frame.ndim == 2 else None
    )
    axes[1].set_title("Frame Puzzle 5 x 5")
    axes[1].axis("off")

    plt.tight_layout()
    plt.show()

    fig, axes = plt.subplots(5, 5, figsize=(12, 12))

    for i, bagian in enumerate(potongan):
        baris = i // 5
        kolom = i % 5

        axes[baris, kolom].imshow(
            konversi(bagian),
            cmap="gray" if bagian.ndim == 2 else None
        )
        axes[baris, kolom].set_title(f"Piece {i + 1}")
        axes[baris, kolom].axis("off")

    plt.suptitle("25 Potongan Puzzle (5 x 5)")
    plt.tight_layout()
    plt.show()


# Program utama
def main():
    print("=== PUZZLE GENERATOR PCD TAHAP 1 ===")
    print("Ukuran puzzle: 5 x 5 (25 potongan)")

    path = pilih_gambar()

    if not path:
        print("Gambar belum dipilih.")
        return

    try:
        gambar = baca_gambar(path)
        tinggi, lebar = gambar.shape[:2]

        if tinggi < M or lebar < M:
            print("Ukuran gambar terlalu kecil.")
            return

        dasar = os.path.dirname(path)
        nama = os.path.splitext(os.path.basename(path))[0]
        folder = os.path.join(dasar, f"output_{nama}_5x5")
        os.makedirs(folder, exist_ok=True)

        frame = buat_frame(tinggi, lebar, gambar.shape)
        path_frame = os.path.join(folder, "frame.png")

        if not cv2.imwrite(path_frame, frame):
            raise IOError("Frame gagal disimpan.")

        potongan = potong_gambar(gambar, folder)

        print("\n=== PROSES SELESAI ===")
        print(f"Ukuran gambar: {lebar} x {tinggi}")
        print("Grid: 5 x 5")
        print("Jumlah potongan: 25")
        print(f"Frame: {path_frame}")
        print(f"Folder output: {folder}")

        tampilkan_hasil(gambar, frame, potongan)

    except (ValueError, OSError, cv2.error) as error:
        print(f"Terjadi kesalahan: {error}")


if __name__ == "__main__":
    main()
