import io
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

data = json.load(sys.stdin)
font_path = "C:/Windows/Fonts/malgun.ttf"
bold_path = "C:/Windows/Fonts/malgunbd.ttf"

def font(size, bold=False):
    path = bold_path if bold else font_path
    return ImageFont.truetype(path, size) if os.path.exists(path) else ImageFont.load_default()

def money(value):
    return f"{round(value):,}원"

items = data["items"]
supply = sum(round(item["quantity"] * item["unitPrice"]) for item in items)
tax = round(supply * data["taxRate"] / 100)
height = max(1400, 900 + len(items) * 78)
image = Image.new("RGB", (1600, height), "white")
draw = ImageDraw.Draw(image)
ink, muted, blue, line = "#171A20", "#5C5E62", "#3E6AE1", "#D0D1D2"
left, right = 120, 1480

draw.text((left, 90), "견 적 서", fill=ink, font=font(58, True))
draw.text((left, 175), "Quotation", fill=muted, font=font(24))
draw.text((right - 360, 104), f"견적번호  {data['quoteNumber']}", fill=muted, font=font(22))
draw.text((right - 360, 148), f"견적일  {data['quoteDate']}", fill=muted, font=font(22))
draw.line((left, 240, right, 240), fill=ink, width=3)

draw.text((left, 285), "받는 분", fill=muted, font=font(22))
draw.text((left + 160, 280), data["clientName"], fill=ink, font=font(28, True))
supplier = data.get("supplier", {})
draw.text((left, 345), "공급자", fill=muted, font=font(22))
draw.text((left + 160, 340), supplier.get("companyName") or "-", fill=ink, font=font(26, True))
draw.text((left + 480, 345), f"대표  {supplier.get('representative') or '-'}", fill=muted, font=font(22))
draw.text((left, 392), f"사업자번호  {supplier.get('registrationNumber') or '-'}", fill=muted, font=font(20))
draw.text((left + 600, 392), f"주소  {supplier.get('address') or '-'}", fill=muted, font=font(20))

top = 470
columns = [left, 610, 835, 980, 1120, 1300, right]
headers = ["품목", "규격", "수량", "단위", "단가", "금액"]
draw.rectangle((left, top, right, top + 58), fill="#F4F4F4")
for index, header in enumerate(headers):
    draw.text((columns[index] + 16, top + 15), header, fill=ink, font=font(20, True))
draw.line((left, top, right, top), fill=ink, width=2)
draw.line((left, top + 58, right, top + 58), fill=ink, width=2)

y = top + 58
for item in items:
    row_bottom = y + 78
    values = [item["name"], item.get("spec", ""), str(item["quantity"]), item.get("unit", "개"), money(item["unitPrice"]), money(item["quantity"] * item["unitPrice"])]
    for index, value in enumerate(values):
        draw.text((columns[index] + 16, y + 23), value, fill=ink, font=font(20))
    draw.line((left, row_bottom, right, row_bottom), fill=line, width=1)
    y = row_bottom

for x in columns:
    draw.line((x, top, x, y), fill=line, width=1)

summary_left = 980
draw.line((summary_left, y + 45, right, y + 45), fill=ink, width=2)
summary = [("공급가액", money(supply)), (f"부가세 ({data['taxRate']}%)", money(tax)), ("합계", money(supply + tax))]
for index, (label, value) in enumerate(summary):
    offset = y + 70 + index * 50
    draw.text((summary_left, offset), label, fill=muted if index < 2 else ink, font=font(21, index == 2))
    draw.text((right - 180, offset), value, fill=blue if index == 2 else ink, font=font(22, index == 2))

notes_y = y + 250
draw.line((left, notes_y, right, notes_y), fill=line, width=1)
draw.text((left, notes_y + 30), "비고", fill=muted, font=font(20, True))
draw.text((left + 100, notes_y + 30), data.get("notes") or "-", fill=ink, font=font(20))
draw.text((left, height - 100), "AI 견적서 작성기", fill=muted, font=font(17))

buffer = io.BytesIO()
image.save(buffer, format="PNG", optimize=True)
sys.stdout.buffer.write(buffer.getvalue())
