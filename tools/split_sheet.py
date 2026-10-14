#!/usr/bin/env python3
"""
三面図（横に 正面・横・後ろ が並んだ 1 枚）を 3 枚の正方形に切り分ける。
ComfyUI の「HY 3D 2.0 MV」（複数の向きの絵から 3D）や Tripo のマルチビューに入れる用。

  python3 tools/split_sheet.py 生成した三面図.png 出力フォルダ

出力：front.png / side.png / back.png（白背景・人物を中央・正方形 1024）。
横向きの絵は「左」用に side_left.png（左右反転したもの）も作る（HY 3D の left 入力用）。
必要：Pillow（pip install pillow）
"""
import os
import sys

from PIL import Image, ImageChops, ImageOps

SIZE = 1024
PAD = 0.08  # 人物の周りの余白（割合）


def content_box(im):
    """白っぽい背景以外の範囲"""
    bg = Image.new('RGB', im.size, (255, 255, 255))
    diff = ImageChops.difference(im.convert('RGB'), bg).convert('L').point(lambda v: 255 if v > 24 else 0)
    return diff.getbbox()


def square(im):
    box = content_box(im)
    if box:
        im = im.crop(box)
    w, h = im.size
    side = int(max(w, h) * (1 + PAD * 2))
    out = Image.new('RGB', (side, side), (255, 255, 255))
    out.paste(im, ((side - w) // 2, (side - h) // 2))
    return out.resize((SIZE, SIZE), Image.LANCZOS)


def main(src, outdir):
    im = Image.open(src).convert('RGB')
    os.makedirs(outdir, exist_ok=True)
    w, h = im.size
    names = ['front', 'side', 'back']
    for i, n in enumerate(names):
        cell = im.crop((i * w // 3, 0, (i + 1) * w // 3, h))
        sq = square(cell)
        sq.save(os.path.join(outdir, f'{n}.png'))
        if n == 'side':
            ImageOps.mirror(sq).save(os.path.join(outdir, 'side_left.png'))
    print(f'{outdir} に front / side / side_left / back を書き出しました')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
    else:
        main(sys.argv[1], sys.argv[2])
