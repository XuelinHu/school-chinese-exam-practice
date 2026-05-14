from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin
import re

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "softcopyright"
ARCHIVE = ROOT / "软著" / "马来西亚留学生汉语练习平台V1.0" / "pdf"
NAME = "马来西亚留学生汉语练习平台"
VERSION = "V1.0"
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
MONO = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

PAGE_W, PAGE_H = 1240, 1754
MARGIN_X, TOP, BOTTOM = 90, 95, 90


class Renderer:
    def __init__(self, code=False):
        self.code = code
        self.pages = []
        self.page = None
        self.draw = None
        self.y = TOP
        self.font = ImageFont.truetype(FONT, 22 if not code else 20)
        self.small = ImageFont.truetype(FONT, 18)
        self.h1 = ImageFont.truetype(BOLD, 34)
        self.h2 = ImageFont.truetype(BOLD, 28)
        self.h3 = ImageFont.truetype(BOLD, 24)
        self.mono = ImageFont.truetype(MONO, 22 if code else 18)
        self.new_page()

    def new_page(self):
        if self.page is not None:
            self.pages.append(self.page)
        self.page = Image.new("RGB", (PAGE_W, PAGE_H), "white")
        self.draw = ImageDraw.Draw(self.page)
        self.draw.text((PAGE_W // 2, 36), f"{NAME} {VERSION}", font=self.small, fill="#222", anchor="mm")
        self.draw.line((MARGIN_X, 62, PAGE_W - MARGIN_X, 62), fill="#999", width=1)
        self.y = TOP

    def finish(self, out):
        if self.page is not None:
            self.pages.append(self.page)
        total = len(self.pages)
        for i, page in enumerate(self.pages, 1):
            draw = ImageDraw.Draw(page)
            draw.text((PAGE_W // 2, PAGE_H - 42), f"{i} / {total}", font=self.small, fill="#333", anchor="mm")
        self.pages[0].save(out, save_all=True, append_images=self.pages[1:], resolution=150.0)

    def ensure(self, height):
        if self.y + height > PAGE_H - BOTTOM:
            self.new_page()

    def width(self, text, font):
        box = self.draw.textbbox((0, 0), text, font=font)
        return box[2] - box[0]

    def wrap(self, text, font, max_w):
        lines, current = [], ""
        for ch in text:
            candidate = current + ch
            if self.width(candidate, font) <= max_w or not current:
                current = candidate
            else:
                lines.append(current)
                current = ch
        if current:
            lines.append(current)
        return lines

    def text(self, text, font=None, indent=0, leading=9):
        font = font or self.font
        max_w = PAGE_W - MARGIN_X * 2 - indent
        for line in self.wrap(text, font, max_w):
            h = font.size + leading
            self.ensure(h)
            self.draw.text((MARGIN_X + indent, self.y), line, font=font, fill="#111")
            self.y += h
        self.y += 4

    def heading(self, text, level):
        font = self.h1 if level == 1 else self.h2 if level == 2 else self.h3
        self.ensure(font.size + 28)
        if level == 1:
            self.draw.text((PAGE_W // 2, self.y), text, font=font, fill="#111", anchor="ma")
        else:
            self.draw.text((MARGIN_X, self.y), text, font=font, fill="#111")
        self.y += font.size + 18

    def code_block(self, lines):
        for raw in lines:
            for line in self.wrap(raw.replace("\t", "  "), self.mono, PAGE_W - MARGIN_X * 2):
                h = self.mono.size + 5
                self.ensure(h)
                self.draw.text((MARGIN_X, self.y), line, font=self.mono, fill="#111")
                self.y += h
        self.y += 10

    def image(self, rel):
        rel = rel.replace("../assets/diagrams/", "../assets/diagrams_png/").replace(".svg", ".png")
        img_path = (DOCS / rel).resolve()
        if not img_path.exists():
            return
        img = Image.open(img_path).convert("RGB")
        max_w = PAGE_W - MARGIN_X * 2
        max_h = 760
        scale = min(max_w / img.width, max_h / img.height, 1.0)
        size = (int(img.width * scale), int(img.height * scale))
        self.ensure(size[1] + 24)
        img = img.resize(size, Image.LANCZOS)
        self.page.paste(img, ((PAGE_W - size[0]) // 2, self.y))
        self.y += size[1] + 18


def render(md_path: Path, pdf_path: Path, code=False):
    r = Renderer(code=code)
    lines = md_path.read_text("utf-8").splitlines()
    in_code = False
    code_lines = []
    table_mode = False
    for line in lines:
        if line.startswith("```"):
            if in_code:
                r.code_block(code_lines)
                code_lines = []
                in_code = False
            else:
                in_code = True
            continue
        if in_code:
            code_lines.append(line)
            continue
        if not line.strip():
            r.y += 6
            continue
        image = re.match(r"^!\[[^\]]*\]\(([^)]+)\)$", line)
        if image:
            r.image(image.group(1))
            continue
        heading = re.match(r"^(#{1,4})\s+(.+)$", line)
        if heading:
            r.heading(heading.group(2), len(heading.group(1)))
            continue
        if line.startswith("|"):
            if re.match(r"^\|\s*-", line):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            r.text("  |  ".join(cells), r.small, leading=6)
            continue
        if line.startswith("- "):
            r.text("• " + line[2:], r.font, indent=12)
            continue
        r.text(line, r.font)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    r.finish(pdf_path)


render(DOCS / f"{NAME}源代码.md", ARCHIVE / f"{NAME}源代码.pdf", code=True)
render(DOCS / "软件设计说明书.md", ARCHIVE / "软件设计说明书.pdf", code=False)
print(ARCHIVE / f"{NAME}源代码.pdf")
print(ARCHIVE / "软件设计说明书.pdf")
