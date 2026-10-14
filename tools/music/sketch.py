#!/usr/bin/env python3
"""
文字で書いた曲のスケッチ → MIDI と試聴用 wav。AI（私）や作者がメロディ案を素早く書いて聴き比べるための道具。

  python3 tools/music/sketch.py docs/music/theme_sketch_01.txt 出力フォルダ

書き方（1 行 1 項目、行頭か空白のあとの「# 」から後ろはメモ）：
  tempo 138
  chords D | Bm | G | A            ← 小節を | で区切る。1 小節に 2 つ書けば半分ずつ
  melody A4:1 A4:.5 B4:.5 D5:2 | C#5:1 B4:1 A4:2   ← 音名オクターブ:拍。休みは r:拍
melody / chords の行は何行でも続けて書ける（順につながる）。
出力：<名前>.mid（メロディ・コード・ベースの 3 トラック）と <名前>.wav（単純な音色。雰囲気の確認用）
必要：pip install pretty_midi soundfile numpy
"""
import os
import re
import sys

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'dim': [0, 3, 6], 'sus4': [0, 5, 7], 'aug': [0, 4, 8]}


def note_num(tok):
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', tok)
    if not m:
        raise ValueError(f'音名が読めない：{tok}')
    n = NAMES[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + n


def chord_notes(tok):
    m = re.fullmatch(r'([A-G])([#b]?)(.*)', tok)
    if not m:
        raise ValueError(f'コードが読めない：{tok}')
    root = NAMES[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    q = m.group(3)
    if q not in QUAL:
        raise ValueError(f'コードの種類が読めない：{tok}')
    return root, QUAL[q]


def parse(path):
    tempo, chords, melody = 120.0, [], []
    for line in open(path, encoding='utf-8'):
        # メモは行頭か空白のあとの「# 」から（C#5 などのシャープとは区別する）
        line = re.sub(r'(^|\s)#(\s.*|$)', '', line).strip()
        if not line:
            continue
        head, _, rest = line.partition(' ')
        if head == 'tempo':
            tempo = float(rest)
        elif head == 'chords':
            chords += [b.split() for b in rest.split('|') if b.strip()]
        elif head == 'melody':
            for tok in rest.replace('|', ' ').split():
                p, _, d = tok.partition(':')
                melody.append((None if p == 'r' else note_num(p), float(d or 1)))
    return tempo, chords, melody


def main(src, out):
    import numpy as np
    import pretty_midi
    import soundfile as sf

    tempo, chords, melody = parse(src)
    beat = 60.0 / tempo
    pm = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    mel = pretty_midi.Instrument(program=61, name='melody')  # ブラス
    pad = pretty_midi.Instrument(program=48, name='chords')  # 弦
    bass = pretty_midi.Instrument(program=32, name='bass')
    t = 0.0
    for p, d in melody:
        if p is not None:
            mel.notes.append(pretty_midi.Note(105, p, t, t + d * beat * 0.95))
        t += d * beat
    t = 0.0
    for bar in chords:
        seg = 4 / len(bar)
        for c in bar:
            root, iv = chord_notes(c)
            for i in iv:
                pad.notes.append(pretty_midi.Note(62, 60 + (root + i) % 12, t, t + seg * beat))
            for k in range(int(seg)):
                bass.notes.append(pretty_midi.Note(90, 36 + root % 12, t + k * beat, t + (k + 0.8) * beat))
            t += seg * beat
    pm.instruments = [mel, pad, bass]
    os.makedirs(out, exist_ok=True)
    name = os.path.splitext(os.path.basename(src))[0]
    pm.write(os.path.join(out, f'{name}.mid'))
    a = pm.synthesize(fs=22050)
    a = a / (np.abs(a).max() + 1e-9) * 0.8
    sf.write(os.path.join(out, f'{name}.wav'), a, 22050)
    print(f'{out}/{name}.mid と .wav を書き出しました（{tempo:.0f} BPM、{len(chords)} 小節、メロディ {len(melody)} 音）')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
    else:
        main(sys.argv[1], sys.argv[2])
