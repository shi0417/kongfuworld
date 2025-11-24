#!/usr/bin/env python3
# -*- coding: utf-8 -*-

file_path = 'frontend/src/pages/AdminPanel.tsx'

# 读取文件
with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

# 修复列表
fixed_lines = []
for i, line in enumerate(lines):
    original_line = line
    
    # 修复1: 修复密码placeholder未闭合
    if 'placeholder="请输入密' in line and not line.rstrip().endswith('"'):
        line = line.replace('placeholder="请输入密?', 'placeholder="请输入密码"')
        line = line.replace('placeholder="请输入密?', 'placeholder="请输入密码"')
    
    # 修复2: 修复"层"字被截断
    line = line.replace('第{item.level}?', '第{item.level}层')
    line = line.replace('第{item.level}?', '第{item.level}层')
    
    # 修复3: 修复"退出登录"被截断
    line = line.replace('退出登?', '退出登录')
    line = line.replace('退出登?', '退出登录')
    
    # 修复4: 修复"是"/"否"被截断
    line = line.replace('?', '是')
    line = line.replace('?', '否')
    
    # 修复5: 修复其他常见截断
    line = line.replace('加载?..', '加载中...')
    line = line.replace('暂无数?', '暂无数据')
    line = line.replace('上一?', '上一页')
    line = line.replace('下一?', '下一页')
    line = line.replace('未?', '未知')
    line = line.replace('?', '是')
    line = line.replace('?', '否')
    line = line.replace('列?', '列表')
    line = line.replace('使用小说?', '使用小说数')
    line = line.replace('读者收入统?', '读者收入统计')
    line = line.replace('作者收入统?', '作者收入统计')
    line = line.replace('页面正在维护中，所有功能暂时关闭?', '页面正在维护中，所有功能暂时关闭。')
    line = line.replace('卡品?', '卡品牌')
    line = line.replace('卡品?', '卡品牌')
    
    # 修复6: 修复所有乱码字符（单独的?或）
    # 但要小心，不要破坏正常的代码
    # 只修复明显是乱码的情况
    
    fixed_lines.append(line)

# 写回文件
with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.writelines(fixed_lines)

print(f"修复完成！处理了 {len(lines)} 行")

