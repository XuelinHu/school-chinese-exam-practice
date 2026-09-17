"""把 docs/assets/screenshots_trilingual_raw 下的原始截图合成为交付用图片。

两类页面：
  * 三语齐全的公共页与学员端页面 → 中文 / English / Bahasa Melayu 三格并排；
  * 只在中文下采集的后台菜单     → 单格大图（后台表格并排三份会小到看不清）。

本脚本只负责图片。每张图的说明文字由 scripts/generate_softcopyright_materials.mjs
的 screenshotDescriptions 统一生成，避免同一段描述在 Python 和 JS 里各存一份后漂移。
"""

from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "docs" / "assets" / "screenshots_trilingual_raw"
OUT = ROOT / "softright" / "images" / "screenshots"
# 旧管线（render_optimized_softcopyright.mjs）仍从 docs 下取图，一并镜像一份
MIRROR = ROOT / "docs" / "assets" / "screenshots_trilingual"
FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

LABELS = [("zh", "中文界面"), ("en", "English"), ("ms", "Bahasa Melayu")]

TRI_PANEL_W = 520
TRI_PANEL_H = 620
SINGLE_PANEL_W = 1240
SINGLE_PANEL_H = 900
LABEL_BAND = 48
GAP = 18


def trim(img):
    """保留真实页宽，去掉底部大片空白。"""
    pix = img.convert("RGB")
    bottom = pix.height
    for y in range(pix.height - 1, 0, -1):
        row = [pix.getpixel((x, y)) for x in range(0, pix.width, 16)]
        if any(pixel != (255, 255, 255) for pixel in row):
            bottom = min(pix.height, y + 24)
            break
    return pix.crop((0, 0, pix.width, bottom))


def panel(file, label, font, width, height):
    """按 width/height 上限等比缩放，画布高度贴合实际内容，不留大片空白。"""
    img = trim(Image.open(file))
    scale = min(width / img.width, height / img.height)
    img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGB", (width, LABEL_BAND + img.height), "white")
    ImageDraw.Draw(canvas).text((width // 2, 18), label, font=font, fill="#222", anchor="mm")
    canvas.paste(img, ((width - img.width) // 2, LABEL_BAND - 2))
    return canvas


def compose(panels, gap):
    out = Image.new("RGB", (sum(p.width for p in panels) + gap * (len(panels) - 1),
                           max(p.height for p in panels)), "white")
    x = 0
    for p in panels:
        out.paste(p, (x, 0))
        x += p.width + gap
    ImageDraw.Draw(out).rectangle((0, 0, out.width - 1, out.height - 1), outline="#d0d0d0", width=2)
    return out


def save(img, name):
    """交付副本统一转中性灰度。

    共同规则要求运行截图用「原图的脱敏中性灰度副本」，这里只做灰阶转换，
    不二值化——保留抗锯齿，否则页面小字会糊成不可读的黑块。
    彩色原图留在 docs/assets/screenshots_trilingual_raw/，需要时随时可比对。
    """
    gray = ImageOps.grayscale(img).convert("RGB")
    for base in (OUT, MIRROR):
        base.mkdir(parents=True, exist_ok=True)
        gray.save(base / name)


def main():
    manifest = json.loads((RAW / "manifest.json").read_text("utf-8"))
    font = ImageFont.truetype(FONT_PATH, 24)

    made = []
    for page in manifest["pages"]:
        key = page["key"]
        # 页面可以用 langs 限定只采集部分语言（后台菜单只采中文）
        wanted = {code.split("-")[0] for code, _ in page.get("langs", [])} if page.get("langs") else None
        shots = [(suffix, label) for suffix, label in LABELS
                 if (wanted is None or suffix in wanted) and (RAW / f"{key}_{suffix}.png").exists()]
        if not shots:
            print(f"  跳过 {key}：没有可用截图")
            continue

        if len(shots) == 1:
            suffix, label = shots[0]
            img = compose([panel(RAW / f"{key}_{suffix}.png", label, font, SINGLE_PANEL_W, SINGLE_PANEL_H)], 0)
            name = f"{key}_{suffix}.png"
        else:
            panels = [panel(RAW / f"{key}_{suffix}.png", label, font, TRI_PANEL_W, TRI_PANEL_H)
                      for suffix, label in shots]
            img = compose(panels, GAP)
            name = f"{key}_trilingual.png"

        save(img, name)
        made.append((name, img.width, img.height))
        print(f"  {name}  {img.width}x{img.height}")

    print(f"共生成 {len(made)} 张交付图片 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
