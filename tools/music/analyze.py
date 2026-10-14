#!/usr/bin/env python3
"""
参考曲の分解：音声（mp3 / wav）→ キー・テンポ・コード進行・曲の区切り・メロディ（MIDI）。
「コード進行・構成・リズムの型は借りて、メロディは新しく作る」ための下調べ用（docs/PIPELINE_MUSIC.md）。

  python3 tools/music/analyze.py 参考曲.mp3 出力フォルダ

出力：
  report.md   … キー、テンポ、区切りごとのコード進行（コード名とローマ数字）、メロディの音度（キーに対する何度か）
  full.mid    … 音声から起こした全部の音（Spotify Basic Pitch）
  melody.mid  … そこから一番上の線だけ抜いたメロディ（似すぎチェック tools/music/similarity.py に使う）

必要：pip install librosa pretty_midi "basic-pitch[onnx]"
精度：自動の耳コピなので、コードは 7 割、メロディは「輪郭が分かる」程度。最後は耳で直す前提。
"""
import os
import sys

import numpy as np

NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
# Krumhansl–Kessler のキーの形
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
ROMAN = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']
DEG = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7']

# コードの形（根音からの半音）
CHORDS = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'dim': [0, 3, 6], 'sus4': [0, 5, 7]}


def estimate_key(chroma_mean):
    best = (-9, 0, 'major')
    for t in range(12):
        for mode, prof in (('major', MAJOR), ('minor', MINOR)):
            c = np.corrcoef(np.roll(prof, t), chroma_mean)[0, 1]
            if c > best[0]:
                best = (c, t, mode)
    return best[1], best[2], best[0]


def chord_of(vec):
    v = vec / (np.linalg.norm(vec) + 1e-9)
    best = (-9, 0, '')
    for root in range(12):
        for q, iv in CHORDS.items():
            tpl = np.zeros(12)
            for i in iv:
                tpl[(root + i) % 12] = 1
            tpl /= np.linalg.norm(tpl)
            # 4 和音は少しだけ不利にする（3 和音で十分な所を 7th にしない）
            s = float(v @ tpl) - (0.03 if len(iv) == 4 else 0)
            if s > best[0]:
                best = (s, root, q)
    return best[1], best[2], best[0]


def roman(root, q, key, mode):
    r = ROMAN[(root - key) % 12]
    if q.startswith('m') and not q.startswith('M'):
        r = r.lower()
    return r + (q[1:] if q.startswith('m') and q != 'm' and not q.startswith('M') else ('' if q in ('', 'm') else q))


def main(src, out):
    import librosa
    import pretty_midi

    os.makedirs(out, exist_ok=True)
    y, sr = librosa.load(src, sr=22050, mono=True)
    dur = len(y) / sr
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(np.atleast_1d(tempo)[0])
    y_h = librosa.effects.harmonic(y)
    chroma = librosa.feature.chroma_cqt(y=y_h, sr=sr)
    key, mode, conf = estimate_key(chroma.mean(axis=1))

    # 2 拍ごとのコード
    beat_frames = librosa.util.fix_frames(beats, x_min=0, x_max=chroma.shape[1])
    seg = librosa.util.sync(chroma, beat_frames[::2], aggregate=np.median)
    times = librosa.frames_to_time(beat_frames[::2], sr=sr)
    chords = []
    for i in range(seg.shape[1]):
        r, q, s = chord_of(seg[:, i])
        t = float(times[i]) if i < len(times) else dur
        name = NOTE[r] + q
        if not chords or chords[-1][1] != name:
            chords.append((t, name, roman(r, q, key, mode)))

    # 曲の区切り（似た響きのまとまり）
    try:
        k = max(2, min(8, int(dur // 25)))
        bounds = librosa.segment.agglomerative(librosa.feature.stack_memory(chroma, n_steps=4), k)
        bt = librosa.frames_to_time(bounds, sr=sr)
    except Exception:
        bt = np.array([0.0])

    # 耳コピ（Basic Pitch）→ 全部の音と、一番上の線（メロディ）
    melody_notes = []
    try:
        from basic_pitch.inference import predict
        from basic_pitch import ICASSP_2022_MODEL_PATH

        _, midi, _ = predict(src, ICASSP_2022_MODEL_PATH)
        midi.write(os.path.join(out, 'full.mid'))
        notes = sorted([n for inst in midi.instruments for n in inst.notes], key=lambda n: (n.start, -n.pitch))
        # 同時に鳴る音のうち一番高い音（声の高さの範囲）を拾い、重なりは切る
        mel = []
        for n in notes:
            if not (52 <= n.pitch <= 88) or n.end - n.start < 0.08:
                continue
            if mel and n.start - mel[-1].start < 0.06:
                if n.pitch > mel[-1].pitch:
                    mel[-1] = n
                continue
            mel.append(n)
        pm = pretty_midi.PrettyMIDI(initial_tempo=tempo)
        inst = pretty_midi.Instrument(program=73, name='melody')
        for i, n in enumerate(mel):
            end = min(n.end, mel[i + 1].start) if i + 1 < len(mel) else n.end
            inst.notes.append(pretty_midi.Note(velocity=100, pitch=n.pitch, start=n.start, end=max(end, n.start + 0.05)))
        pm.instruments.append(inst)
        pm.write(os.path.join(out, 'melody.mid'))
        melody_notes = inst.notes
    except Exception as e:  # noqa: BLE001
        print('耳コピは失敗（コードとキーだけ出す）：', e)

    beat_sec = 60.0 / tempo
    with open(os.path.join(out, 'report.md'), 'w', encoding='utf-8') as f:
        f.write(f'# 分解メモ：{os.path.basename(src)}\n\n')
        f.write(f'- 長さ：{dur:.0f} 秒\n- テンポ：約 {tempo:.0f} BPM（1 拍 {beat_sec:.2f} 秒）\n')
        f.write(f'- キー：{NOTE[key]} {"メジャー" if mode == "major" else "マイナー"}（確からしさ {conf:.2f}）\n\n')
        f.write('## 区切り（似た響きのまとまり）\n\n')
        f.write(', '.join(f'{t:.0f}秒' for t in bt) + '\n\n')
        f.write('## コード進行（2 拍ごとに推定、続きはまとめた）\n\n| 時刻 | コード | 度数 |\n|---|---|---|\n')
        for t, n, r in chords:
            f.write(f'| {t:.1f} | {n} | {r} |\n')
        if melody_notes:
            f.write('\n## メロディの輪郭（キーに対する音度、最初の 64 音）\n\n')
            f.write('数字は音度（1＝主音）。高さの変化と、音の長さ（拍）を並べたもの。**この形をそのまま使わないこと**（ここが著作権で守られる部分）。\n\n')
            row = []
            for n in melody_notes[:64]:
                d = DEG[(n.pitch - key) % 12]
                ln = (n.end - n.start) / beat_sec
                row.append(f'{d}({ln:.1f})')
            f.write(' '.join(row) + '\n')
    print(f'{out}/report.md ほかを書き出しました（キー {NOTE[key]} {mode}、{tempo:.0f} BPM、コード {len(chords)} 個）')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
    else:
        main(sys.argv[1], sys.argv[2])
