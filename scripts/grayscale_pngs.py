"""把交付目录里的运行截图就地转成中性灰度副本。

共同规则要求「运行截图交付使用原图的脱敏中性灰度副本」，只做灰阶转换、
不二值化，保留抗锯齿，否则页面小字会糊成不可读的黑块。
彩色原图保留在 docs/assets/screenshots_trilingual_raw/ 供比对。

用法：python3 scripts/grayscale_pngs.py <文件或目录> [...]
"""

from pathlib import Path
import sys

from PIL import Image, ImageOps


def convert(path: Path) -> bool:
    """就地转灰度；返回是否真的改写过。"""
    with Image.open(path) as im:
        rgb = im.convert("RGB")
        gray = ImageOps.grayscale(rgb).convert("RGB")
        if gray.tobytes() == rgb.tobytes():
            return False
        gray.save(path)
        return True


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2

    changed = 0
    checked = 0
    for raw in argv:
        target = Path(raw)
        files = sorted(target.glob("*.png")) if target.is_dir() else [target]
        for file in files:
            if not file.is_file():
                print(f"跳过（不存在）：{file}")
                continue
            checked += 1
            if convert(file):
                changed += 1
    print(f"灰度处理完成：检查 {checked} 张，改写 {changed} 张")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
