#!/usr/bin/env python3
"""
メロディの似すぎチェック：自作メロディ（MIDI）と参考曲のメロディ（MIDI）を比べる。
移調しても同じに見えるよう「音程の動き（半音いくつ上下したか）」と「リズム（音の長さの比）」で比べる。

  python3 tools/music/similarity.py 自作.mid 参考.mid [参考2.mid ...]

判定の目安（機械の目安。最後は耳と人の判断）：
  高い … 音程とリズムが 8 音以上そのまま続けて一致 → その部分は書き直す
  中   … 5〜7 音の一致、または 6 音の並びの共通率が高い → 気になる所を変える
  低   … それ以下。よくある動き（ドレミ等）はどの曲にもあるので 4 音以下の一致は気にしない
必要：pip install pretty_midi
"""
import sys


def melody(path):
    import pretty_midi

    pm = pretty_midi.PrettyMIDI(path)
    notes = sorted([n for i in pm.instruments if not i.is_drum for n in i.notes], key=lambda n: (n.start, -n.pitch))
    mel = []
    for n in notes:
        if mel and abs(n.start - mel[-1].start) < 0.05:
            continue  # 同時の音は一番上だけ
        mel.append(n)
    return mel


def features(mel):
    iv = [mel[i + 1].pitch - mel[i].pitch for i in range(len(mel) - 1)]
    durs = [max(0.05, mel[i + 1].start - mel[i].start) for i in range(len(mel) - 1)]
    # リズムは「前の音との長さの比」を 3 段に丸める（短く / 同じ / 長く）
    rr = [0] + [(-1 if durs[i] / durs[i - 1] < 0.8 else 1 if durs[i] / durs[i - 1] > 1.25 else 0) for i in range(1, len(durs))]
    return iv, rr


def longest_run(a_iv, a_rr, b_iv, b_rr, use_rhythm=True):
    best = (0, 0, 0)
    for i in range(len(a_iv)):
        for j in range(len(b_iv)):
            k = 0
            while i + k < len(a_iv) and j + k < len(b_iv) and a_iv[i + k] == b_iv[j + k] and (not use_rhythm or k == 0 or a_rr[i + k] == b_rr[j + k]):
                k += 1
            if k > best[0]:
                best = (k, i, j)
    return best


def ngram_share(a, b, n=6):
    A = {tuple(a[i:i + n]) for i in range(len(a) - n + 1)}
    B = {tuple(b[i:i + n]) for i in range(len(b) - n + 1)}
    if not A:
        return 0.0
    return len(A & B) / len(A)


def main(mine, refs):
    m = melody(mine)
    m_iv, m_rr = features(m)
    worst = '低'
    for ref in refs:
        r = melody(ref)
        r_iv, r_rr = features(r)
        run, i, j = longest_run(m_iv, m_rr, r_iv, r_rr, True)
        run_p, _, _ = longest_run(m_iv, m_rr, r_iv, r_rr, False)
        share = ngram_share(m_iv, r_iv, 6)
        level = '高' if run + 1 >= 8 else '中' if run + 1 >= 5 or share > 0.15 else '低'
        if level == '高' or (level == '中' and worst == '低'):
            worst = level
        print(f'--- {ref}')
        print(f'  音程＋リズムの一致：最長 {run + 1} 音（自作の {i + 1} 音目〜 {m[i].start:.1f} 秒、参考の {j + 1} 音目〜 {r[j].start:.1f} 秒）')
        print(f'  音程だけの一致：最長 {run_p + 1} 音')
        print(f'  6 音の並びの共通率：{share * 100:.0f}%')
        print(f'  判定：{level}')
    print(f'=== 総合：{worst}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
    else:
        main(sys.argv[1], sys.argv[2:])
