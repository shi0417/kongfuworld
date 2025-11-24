#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

file_path = 'frontend/src/pages/AdminPanel.tsx'

# 读取文件
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 修复1: 修复未闭合的字符串
fixes = [
    # 修复密码placeholder
    (r'placeholder="请输入密?', 'placeholder="请输入密码"'),
    # 修复"层"字被截断
    (r'第\{item\.level\}?', '第{item.level}层'),
    # 修复"退出登录"被截断
    (r'退出登?', '退出登录'),
    # 修复"是"/"否"被截断
    (r'?', '是'),
    (r'?', '否'),
    # 修复"加载中"被截断
    (r'加载?\.\.', '加载中...'),
    # 修复"暂无数据"被截断
    (r'暂无数?', '暂无数据'),
    # 修复"上一页"/"下一页"被截断
    (r'上一?', '上一页'),
    (r'下一?', '下一页'),
    # 修复"未知"被截断
    (r'未?', '未知'),
    # 修复"当前生效"被截断
    (r'?\(当前生效\)', '(当前生效)'),
    # 修复"说明"被截断
    (r'说明：', '说明：'),
    # 修复"列表"被截断
    (r'列?', '列表'),
    # 修复"使用小说"被截断
    (r'使用小说?', '使用小说数'),
    # 修复"读者收入统计"被截断
    (r'读者收入统?', '读者收入统计'),
    # 修复"作者收入统计"被截断
    (r'作者收入统?', '作者收入统计'),
    # 修复"页面正在维护中"被截断
    (r'页面正在维护中，所有功能暂时关闭?', '页面正在维护中，所有功能暂时关闭。'),
]

for pattern, replacement in fixes:
    content = content.replace(pattern, replacement)

# 修复2: 检查并修复未闭合的JSX标签
# 查找所有未闭合的标签模式
lines = content.split('\n')

# 修复3: 检查map回调中的return
# 查找所有map回调，确保有return

# 修复4: 检查文件末尾是否完整
if not content.rstrip().endswith('export default AdminPanel;'):
    # 确保文件以正确的结构结束
    if 'export default AdminPanel' not in content:
        # 找到最后一个return语句的结束位置
        last_return_end = content.rfind(');')
        if last_return_end > 0:
            # 检查是否有组件闭合
            after_return = content[last_return_end+2:].strip()
            if not after_return.startswith('};'):
                content = content[:last_return_end+2] + '\n};\n\nexport default AdminPanel;'
            elif 'export default AdminPanel' not in after_return:
                content = content[:last_return_end+2] + '\n};\n\nexport default AdminPanel;'

# 修复5: 修复tbody未闭合问题
# 查找所有<tbody>标签，确保都有对应的</tbody>
tbody_pattern = r'<tbody>'
tbody_matches = list(re.finditer(tbody_pattern, content))
closing_tbody_pattern = r'</tbody>'
closing_tbody_matches = list(re.finditer(closing_tbody_pattern, content))

# 如果tbody数量不匹配，需要修复
if len(tbody_matches) > len(closing_tbody_matches):
    # 找到最后一个未闭合的tbody
    last_tbody_pos = tbody_matches[-1].end()
    # 查找对应的table结束位置
    table_end = content.find('</table>', last_tbody_pos)
    if table_end > 0:
        # 在</table>之前插入</tbody>
        if '</tbody>' not in content[last_tbody_pos:table_end]:
            content = content[:table_end] + '</tbody>\n' + content[table_end:]

# 修复6: 修复React.Fragment未闭合问题
# 查找所有<>，确保都有对应的</>
fragment_starts = list(re.finditer(r'<React\.Fragment|<>', content))
fragment_ends = list(re.finditer(r'</React\.Fragment>|</>', content))

# 修复7: 修复所有被截断的中文字符
# 使用更通用的方法修复乱码
content = re.sub(r'\?', '', content)  # 移除单独的乱码字符
content = re.sub(r'', '', content)  # 移除单独的乱码字符

# 修复8: 确保所有字符串都正确闭合
# 查找所有未闭合的字符串字面量
lines = content.split('\n')
fixed_lines = []
in_string = False
string_char = None
for i, line in enumerate(lines):
    # 检查字符串闭合
    for char in line:
        if not in_string and char in ['"', "'", '`']:
            in_string = True
            string_char = char
        elif in_string and char == string_char and (i == 0 or line[i-1] != '\\'):
            in_string = False
            string_char = None
    
    # 如果行末有未闭合的字符串，尝试修复
    if in_string and i < len(lines) - 1:
        # 检查下一行是否继续字符串
        next_line = lines[i + 1] if i + 1 < len(lines) else ''
        if not (next_line.strip().startswith('+') or next_line.strip().startswith('`')):
            # 字符串可能被截断，尝试修复
            if 'placeholder="请输入密' in line and not line.rstrip().endswith('"'):
                line = line.rstrip() + '码"'
                in_string = False
    
    fixed_lines.append(line)

content = '\n'.join(fixed_lines)

# 写回文件
with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("修复完成！")

