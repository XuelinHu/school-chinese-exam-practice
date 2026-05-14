from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "docs" / "assets" / "screenshots_trilingual_raw"
OUT = ROOT / "docs" / "assets" / "screenshots_trilingual"
ARCHIVE = ROOT / "软著" / "马来西亚留学生汉语练习平台V1.0" / "images" / "screenshots"
FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

LABELS = [("zh", "中文界面"), ("en", "English"), ("ms", "Bahasa Melayu")]

DESCRIPTIONS = {
    "login": "登录页面三语并排截图展示公开登录入口在中文、英文、马来语界面下的呈现效果。页面包含系统名称、用户名输入框、密码输入框、登录按钮、注册链接和语言切换入口，是用户进入系统的身份认证入口。该截图对应用户认证需求，说明系统在未登录状态下即可切换界面语言，并通过登录表单进入学生端或管理端。",
    "register": "注册页面三语并排截图展示学生账号创建入口在三种语言下的表单布局。页面包含用户名、密码、姓名、邮箱、电话、学号、国籍和注册提交按钮。该截图对应用户注册需求，说明系统支持留学生自助创建学生账号，并将基础身份资料写入用户数据表，为后续练习、成绩记录和错题本建立用户归属。",
    "home": "学生首页三语并排截图展示登录后的主导航页面。页面包含系统标题、练习入口、错题本入口、成绩入口、个人中心入口和退出按钮。该截图对应主导航和学生学习入口需求，说明系统在不同语言下保持一致的信息架构，学生可从首页快速进入练习、复习和学习记录查看流程。",
    "practice_list": "练习列表三语并排截图展示系统从后台题库读取已发布练习后的列表效果。页面包含练习名称、练习说明、等级、题数和总分等信息，不同语言下题库标题和说明由数据库翻译表提供。该截图对应练习资源展示需求，说明前台会根据语言状态请求不同 lang 参数并展示对应语言内容。",
    "practice_detail": "答题详情三语并排截图展示学生进入练习后的在线答题界面。页面包含题号、题目标题、题干内容、题目分类、难度、选项按钮、上一题/下一题或提交按钮以及题目导航区域。该截图对应在线答题需求，说明系统支持学生逐题查看题目、选择答案，并为最终提交成绩提供页面交互基础。",
    "records": "成绩记录三语并排截图展示学生完成练习后的历史成绩列表。页面以表格形式展示练习标题、题目数量、正确数、错误数、得分和提交时间。该截图对应学习记录需求，说明后台提交接口生成的 study_records 数据可以被学生端查询和回看，便于跟踪学习效果。",
    "wrong_book": "错题本三语并排截图展示学生错题复习入口。页面用于展示答错题目的标题、分类、错误次数和解析信息；当没有待复习错题时显示空状态。该截图对应错题复习需求，说明系统在答题提交时维护 wrong_questions 数据，并为学生提供针对性复习入口。",
    "profile": "个人中心三语并排截图展示学生资料维护页面。页面包含姓名、邮箱、电话、国籍、语言偏好选择和提交按钮。该截图对应个人资料维护需求，说明学生可以维护基础资料和语言设置，后台依据当前登录用户更新 users 表中的个人信息。",
    "admin_dashboard": "管理台看板三语并排截图展示管理员登录后的统计首页。页面包含学生数、题目数、练习数、平均分等指标，以及学生管理、题库、练习试卷、成绩记录入口。该截图对应管理员数据看板需求，说明系统可汇总核心业务数据并为教学管理人员提供导航入口。",
    "admin_users": "学生管理列表三语并排截图展示管理员查看用户数据的页面。表格包含用户编号、用户名、姓名、角色、学号、国籍、语言和状态等字段。该截图对应学生管理查看需求，说明管理员可审阅平台用户基础信息，并与 users 数据表保持一致。",
    "admin_questions": "题库管理列表三语并排截图展示管理员查看题库资源的页面。表格包含题目编号、标题、等级、分类、题型、难度、分值和状态。该截图对应题库管理查看需求，说明系统能够按语言显示题目翻译内容，并为题库维护和教学分析提供数据基础。",
    "admin_papers": "练习试卷列表三语并排截图展示管理员查看练习配置的页面。表格包含试卷编号、标题、类型、题目数量、总分、时长和状态。该截图对应练习试卷管理查看需求，说明系统通过 papers 与 paper_questions 组织练习内容，管理员可查看练习发布情况。",
    "admin_records": "成绩记录管理三语并排截图展示管理员查看全量学习成绩的页面。表格包含用户、姓名、练习标题、题目数量、正确数、错误数、得分和提交时间。该截图对应教学成绩管理需求，说明管理员可从管理端查看学习行为数据，为教学跟踪提供依据。"
}


def crop_bottom_whitespace(img):
    bg = Image.new(img.mode, img.size, "white")
    diff = Image.eval(Image.composite(Image.new("L", img.size, 255), Image.new("L", img.size, 0), Image.eval(ImageChops.difference(img, bg), lambda x: 255 if x else 0)) if False else Image.new("L", img.size, 0), lambda x: x)
    return img


def trim(img):
    # Keep the real page width and remove excessive blank bottom area.
    pix = img.convert("RGB")
    bottom = pix.height
    for y in range(pix.height - 1, 0, -1):
        row = [pix.getpixel((x, y)) for x in range(0, pix.width, 16)]
        if any(pixel != (255, 255, 255) for pixel in row):
            bottom = min(pix.height, y + 24)
            break
    return pix.crop((0, 0, pix.width, bottom))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((RAW / "manifest.json").read_text("utf-8"))
    font = ImageFont.truetype(FONT_PATH, 24)
    small = ImageFont.truetype(FONT_PATH, 20)

    for page in manifest["pages"]:
        key = page["key"]
        panels = []
        for suffix, label in LABELS:
            img = trim(Image.open(RAW / f"{key}_{suffix}.png"))
            max_w = 520
            max_h = 620
            scale = min(max_w / img.width, max_h / img.height)
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
            canvas = Image.new("RGB", (max_w, max_h + 48), "white")
            draw = ImageDraw.Draw(canvas)
            draw.text((max_w // 2, 18), label, font=font, fill="#222", anchor="mm")
            canvas.paste(img, ((max_w - img.width) // 2, 46))
            panels.append(canvas)

        gap = 18
        out = Image.new("RGB", (len(panels) * 520 + gap * 2, max(p.height for p in panels)), "white")
        x = 0
        for panel in panels:
            out.paste(panel, (x, 0))
            x += 520 + gap
        draw = ImageDraw.Draw(out)
        draw.rectangle((0, 0, out.width - 1, out.height - 1), outline="#d0d0d0", width=2)
        out_path = OUT / f"{key}_trilingual.png"
        out.save(out_path)
        (OUT / f"{key}_trilingual.txt").write_text(DESCRIPTIONS[key], "utf-8")
        out.save(ARCHIVE / out_path.name)
        (ARCHIVE / f"{key}_trilingual.txt").write_text(DESCRIPTIONS[key], "utf-8")


if __name__ == "__main__":
    main()
