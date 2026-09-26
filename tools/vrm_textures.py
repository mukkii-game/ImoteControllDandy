#!/usr/bin/env python3
"""
VRM（中身は glb）の中のテクスチャ画像を取り出す／描き直した画像で差し替える道具。標準ライブラリだけで動く。

  取り出す:  python3 tools/vrm_textures.py extract public/models/custom/imouto.vrm tools/imouto_tex
  戻す:      python3 tools/vrm_textures.py replace public/models/custom/imouto.vrm tools/imouto_tex public/models/custom/imouto.vrm

取り出したファイル名は「番号_画像名.png」。描き直すときは同じ名前・同じ縦横サイズのまま上書きする。
replace はフォルダ内の「番号_*.png / .jpg」を見て、その番号の画像だけを差し替える（触っていない画像はそのまま）。
どの画像がどの材質（髪・服・目…）に使われているかは、取り出し時に作る index.txt を見る。
"""
import json
import os
import struct
import sys


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, _ = struct.unpack('<4sII', data[:12])
    if magic != b'glTF':
        sys.exit(f'{path} は glb / vrm ではありません')
    off = 12
    js = binc = None
    while off < len(data):
        ln, typ = struct.unpack('<II', data[off:off + 8])
        chunk = data[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk)
        elif typ == 0x004E4942:
            binc = chunk
        off += 8 + ln
    return version, js, binc


def write_glb(path, version, js, binc):
    jb = json.dumps(js, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    binc += b'\0' * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(binc)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', version, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A) + jb)
        f.write(struct.pack('<II', len(binc), 0x004E4942) + binc)


def ext_of(mime):
    return '.jpg' if mime == 'image/jpeg' else '.png'


def safe(name):
    return ''.join(c if c.isalnum() or c in '-_' else '_' for c in name)[:60]


def usage_map(js):
    """画像番号 → それを使う材質名の一覧"""
    tex2img = {i: t.get('source') for i, t in enumerate(js.get('textures', []))}
    used = {}

    def walk(o, mat):
        if isinstance(o, dict):
            if 'index' in o and isinstance(o['index'], int) and len(o) <= 4:
                img = tex2img.get(o['index'])
                if img is not None:
                    used.setdefault(img, set()).add(mat)
            for v in o.values():
                walk(v, mat)
        elif isinstance(o, list):
            for v in o:
                walk(v, mat)

    for m in js.get('materials', []):
        walk(m, m.get('name', '?'))
    # VRM0 の MToon は extensions.VRM.materialProperties の textureProperties に画像を持つ
    for mp in js.get('extensions', {}).get('VRM', {}).get('materialProperties', []):
        for t in mp.get('textureProperties', {}).values():
            img = tex2img.get(t)
            if img is not None:
                used.setdefault(img, set()).add(mp.get('name', '?'))
    return used


def extract(src, outdir):
    _, js, binc = read_glb(src)
    os.makedirs(outdir, exist_ok=True)
    used = usage_map(js)
    lines = []
    for i, im in enumerate(js.get('images', [])):
        bv = js['bufferViews'][im['bufferView']]
        o = bv.get('byteOffset', 0)
        blob = binc[o:o + bv['byteLength']]
        fn = f"{i:02d}_{safe(im.get('name', 'img'))}{ext_of(im.get('mimeType'))}"
        open(os.path.join(outdir, fn), 'wb').write(blob)
        size = ''
        if blob[:8] == b'\x89PNG\r\n\x1a\n':
            w, h = struct.unpack('>II', blob[16:24])
            size = f'{w}x{h}'
        mats = ', '.join(sorted(used.get(i, []))) or '(未使用)'
        lines.append(f'{fn}\t{size}\t{mats}')
    open(os.path.join(outdir, 'index.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    print(f'→ {outdir} に {len(lines)} 枚')


def replace(src, texdir, dst):
    version, js, binc = read_glb(src)
    repl = {}
    for fn in os.listdir(texdir):
        head = fn.split('_', 1)[0]
        if head.isdigit() and fn.lower().endswith(('.png', '.jpg', '.jpeg')):
            repl[int(head)] = fn
    img_views = {}
    for i, im in enumerate(js.get('images', [])):
        if i in repl:
            img_views[im['bufferView']] = (i, repl[i])
    changed = 0
    out = bytearray()
    for vi, bv in enumerate(js['bufferViews']):
        o = bv.get('byteOffset', 0)
        blob = binc[o:o + bv['byteLength']]
        if vi in img_views:
            i, fn = img_views[vi]
            nb = open(os.path.join(texdir, fn), 'rb').read()
            if nb != blob:
                blob = nb
                js['images'][i]['mimeType'] = 'image/jpeg' if fn.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
                changed += 1
        out += b'\0' * ((4 - len(out) % 4) % 4)
        bv['byteOffset'] = len(out)
        bv['byteLength'] = len(blob)
        out += blob
    js['buffers'][0]['byteLength'] = len(out)
    write_glb(dst, version, js, bytes(out))
    print(f'{changed} 枚を差し替えて {dst} に書き出しました')


if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == 'extract':
        extract(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 5 and sys.argv[1] == 'replace':
        replace(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        print(__doc__)
