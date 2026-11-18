"""Convert the canvas .dc.html files into plain HTML pages that run with dc-lite.js."""
import html
import json
import pathlib
import re
import shutil
import sys
from html.parser import HTMLParser

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
RUNTIME = pathlib.Path(sys.argv[3])

PAGES = [
    'Main', 'E01_Explore', 'E02_Detail', 'E03_Form', 'E04_Status', 'N01_Notices',
    'M01_Member', 'M01_Works', 'S01_LearnerList', 'S02_Space', 'T01_SharerList',
    'T02_Invite', 'T03_Workspace', 'T04_Live', 'H01_HostList', 'H02_Create',
    'H03_Manage', 'H04_Recruit',
]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
ATTR = re.compile(r'''([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?''')


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = []
        self.stack = [('#root', {}, self.root)]

    def _attrs(self):
        raw = self.get_starttag_text()
        body = re.sub(r'^<\s*[^\s/>]+', '', raw).rstrip('>').rstrip('/')
        out = {}
        for m in ATTR.finditer(body):
            name = m.group(1)
            val = next((g for g in m.group(2, 3, 4) if g is not None), '')
            out[name] = html.unescape(val)
        return out

    def handle_starttag(self, tag, attrs):
        node = [tag, self._attrs(), []]
        self.stack[-1][2].append(node)
        if tag not in VOID:
            self.stack.append((tag, node[1], node[2]))

    def handle_startendtag(self, tag, attrs):
        self.stack[-1][2].append([tag, self._attrs(), []])

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if data:
            self.stack[-1][2].append(data)


def parse(path):
    text = path.read_text(encoding='utf-8')
    title = re.search(r'<title>(.*?)</title>', text, re.S).group(1)
    xdc = re.search(r'<x-dc>(.*)</x-dc>', text, re.S).group(1)
    helm = re.search(r'<helmet>(.*?)</helmet>', xdc, re.S)
    helmet = helm.group(1).strip() if helm else ''
    tpl_src = xdc.replace(helm.group(0), '') if helm else xdc
    code = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', text, re.S).group(1)
    t = Tree()
    t.feed(tpl_src)
    t.close()
    return {'title': title, 'helmet': helmet, 'tpl': t.root, 'code': code}



OUT.mkdir(parents=True, exist_ok=True)

comps = {p.name[:-len('.dc.html')]: parse(p) for p in sorted(SRC.glob('*.dc.html'))}

lines = ['/* 由 tools/convert.py 從原型自動產生，請勿手動修改 */']
for name, c in comps.items():
    lines.append(
        'DC.reg(%s, %s, %s, function (DCLogic) {\n%s\nreturn Component;\n});'
        % (json.dumps(name), json.dumps(c['tpl'], ensure_ascii=False),
           json.dumps(c['helmet'], ensure_ascii=False), c['code'].strip())
    )
(OUT / 'components.js').write_text('\n\n'.join(lines) + '\n', encoding='utf-8')

PAGE = '''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="wf.css">
{helmet}
</head>
<body>
<div id="root"></div>
<script src="dc-lite.js"></script>
<script src="components.js"></script>
<script>DC.mount({name}, document.getElementById('root'));</script>
</body>
</html>
'''
for name in PAGES:
    c = comps[name]
    fname = 'index.html' if name == 'Main' else name + '.html'
    (OUT / fname).write_text(PAGE.format(title=html.escape(c['title']), helmet=c['helmet'],
                                         name=json.dumps(name)), encoding='utf-8')

shutil.copy(SRC / 'wf.css', OUT / 'wf.css')
shutil.copy(RUNTIME, OUT / 'dc-lite.js')
print('components', len(comps), 'pages', len(PAGES))
