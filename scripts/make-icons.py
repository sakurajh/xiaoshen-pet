from PIL import Image, ImageDraw, ImageFilter
import os

S = 4
W = 512
img = Image.new('RGBA', (W*S, W*S), (0,0,0,0))
d = ImageDraw.Draw(img)

def sc(*v):
    return tuple(int(x*S) for x in v)

# rounded background
d.rounded_rectangle(sc(18,18,494,494), radius=118*S, fill=(250,240,229,255))
d.ellipse(sc(70,50,460,440), fill=(247,227,207,255))
# subtle halo
d.ellipse(sc(140,100,390,350), fill=(252,243,232,255))

# shoulders / sweater
d.rounded_rectangle(sc(96,354,416,512), radius=86*S, fill=(234,230,223,255))
d.rectangle(sc(96,354,416,420), fill=(234,230,223,255))
# navy collar
d.rounded_rectangle(sc(202,344,310,392), radius=22*S, fill=(31,46,66,255))
# neck
d.rounded_rectangle(sc(230,302,282,378), radius=26*S, fill=(238,196,170,255))
# necklace
d.arc(sc(192,330,320,430), 20, 160, fill=(210,214,214,255), width=4*S)
d.ellipse(sc(250,392,266,406), fill=(214,218,218,255))

# head
d.ellipse(sc(118,92,394,390), fill=(247,213,190,255))
# ears
d.ellipse(sc(104,206,142,292), fill=(243,203,178,255))
d.ellipse(sc(370,206,408,292), fill=(243,203,178,255))
# earrings
d.ellipse(sc(116,284,130,298), fill=(217,170,75,255))
d.ellipse(sc(382,284,396,298), fill=(217,170,75,255))

# back hair
d.ellipse(sc(96,74,416,370), fill=(59,38,29,255))
d.ellipse(sc(116,102,396,350), fill=(78,50,35,255))
# face opening
d.ellipse(sc(132,128,380,388), fill=(247,213,190,255))
# hair cap / bangs
d.ellipse(sc(108,68,404,258), fill=(59,38,29,255))
# fringe locks
d.polygon(sc(138,168,212,128,218,244,178,268), fill=(72,46,33,255))
d.polygon(sc(198,148,284,132,270,248,222,262), fill=(92,59,40,255))
d.polygon(sc(268,140,348,168,300,250,260,236), fill=(64,41,30,255))
d.polygon(sc(330,180,372,190,338,252,310,240), fill=(105,68,46,255))
# bun
d.ellipse(sc(322,44,440,166), fill=(116,76,49,255))
d.ellipse(sc(334,58,426,148), fill=(139,94,61,255))
d.ellipse(sc(352,72,410,128), fill=(157,108,72,255))
# clip
d.arc(sc(302,78,392,164), 160, 350, fill=(62,39,27,255), width=13*S)
# cheeks
d.ellipse(sc(162,272,224,312), fill=(238,160,147,120))
d.ellipse(sc(290,272,352,312), fill=(238,160,147,120))
# glasses
for x0,x1 in [(146,252),(260,366)]:
    d.ellipse(sc(x0,200,x1,306), outline=(29,26,24,255), width=14*S)
    # lens tint
    d.ellipse(sc(x0+14,214,x1-14,292), fill=(225,241,246,35))
# bridge
d.line(sc(252,246,260,246), fill=(29,26,24,255), width=10*S)
# temples
d.line(sc(146,236,116,222), fill=(29,26,24,255), width=9*S)
d.line(sc(366,236,396,222), fill=(29,26,24,255), width=9*S)
# eyes
d.ellipse(sc(186,244,206,266), fill=(42,32,26,255))
d.ellipse(sc(312,244,332,266), fill=(42,32,26,255))
d.ellipse(sc(191,247,198,254), fill=(255,255,255,255))
d.ellipse(sc(317,247,324,254), fill=(255,255,255,255))
# nose
d.ellipse(sc(249,280,261,290), fill=(225,174,148,255))
# mouth
d.arc(sc(222,296,282,330), 20, 160, fill=(193,105,110,255), width=5*S)
# dog patch hint
d.rounded_rectangle(sc(292,420,376,484), radius=16*S, fill=(250,246,238,255))

# downscale
icon = img.resize((W, W), Image.LANCZOS)
os.makedirs('assets', exist_ok=True)
icon.save('assets/icon.png')
icon.save('assets/icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

# tray icon: circular plate, no square background, simplified for 16 px
T = 4
tray_img = Image.new('RGBA', (128*T, 128*T), (0,0,0,0))
td = ImageDraw.Draw(tray_img)
def ts(*v): return tuple(int(x*T) for x in v)
td.ellipse(ts(2,2,126,126), fill=(250,240,229,255))
td.ellipse(ts(12,12,116,116), fill=(247,213,190,255))
td.ellipse(ts(18,46,110,122), fill=(234,230,223,255))
td.ellipse(ts(10,8,118,86), fill=(59,38,29,255))
td.ellipse(ts(82,4,124,46), fill=(139,94,61,255))
td.ellipse(ts(28,30,100,104), fill=(247,213,190,255))
for x0,x1 in [(26,62),(66,102)]:
    td.ellipse(ts(x0,46,x1,80), outline=(29,26,24,255), width=4*T)
td.line(ts(62,61,66,61), fill=(29,26,24,255), width=3*T)
td.ellipse(ts(38,55,46,64), fill=(42,32,26,255))
td.ellipse(ts(82,55,90,64), fill=(42,32,26,255))
td.arc(ts(50,72,78,90), 20, 160, fill=(193,105,110,255), width=3*T)
tray = tray_img.resize((64,64), Image.LANCZOS)
tray.save('assets/tray.png')
print('icons written')
