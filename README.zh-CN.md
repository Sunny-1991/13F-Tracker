# 13F Tracker（中文版说明）

13F Tracker 是一个基于 SEC Form 13F 的机构持仓跟踪看板，用于观察重点机构在美股市场的季度持仓变化。

项目采用纯静态前端（`index.html`、`app.js`、`styles.css`），数据来自本地准备的 SEC JSON 文件。

- English README: [`README.md`](./README.md)

## 功能亮点

- 双阶段流程：机构目录 -> 机构详情
- 机构详情页季度选择会根据该机构真实 SEC 数据范围自动限制
- 热力 Treemap 支持跨机构联动高亮
- 持仓表、环形图、季度变动榜单、详情页快照导出
- 强化 ticker 归一化与风格分类，降低 `Other` 虚高

## 页面流程

### Step 1：机构目录页

- 机构卡片（经理信息、AUM 概览、风格标签）
- 支持按机构名/经理/风格/ticker 关键词快速筛选
- 热门持仓 Treemap：
  - hover + click 交互
  - 方块内统一显示股票代码（ticker）
  - 可聚焦“同一标的被哪些机构共同持有”

### Step 2：机构详情页

- 季度选择器（自动按机构可用季度生成）
- 官方网站入口（有则展示）
- 组合演化与风格快照：
  - 净资产趋势图
  - 机构风格雷达（对比 S&P 500 基准）
- 当季持仓总览：
  - 默认前 15，可展开全部
  - 交互式饼图与标签
- 环比变动面板：
  - Add / Trim 双栏排行
  - 优先使用份额变化进行变动判断
- 一键导出详情快照（PNG）

## 数据覆盖范围

- 数据源：SEC EDGAR 13F
- 全局覆盖基线：从 `1999Q1` 开始（各机构起始季度不同）
- 主要数据文件：
  - `data/sec-13f-history.json`
  - `data/sec-13f-latest.json`

当前本地数据中，各机构最早季度：

- Berkshire Hathaway：`1999Q1`
- Soros Fund Management：`1999Q1`
- Tiger Global：`2001Q4`
- Gates Foundation Trust：`2002Q3`
- Bridgewater：`2005Q4`
- Pershing Square：`2005Q4`
- SoftBank Group：`2013Q4`
- TCI：`2015Q2`
- ARK：`2016Q4`
- Himalaya：`2016Q4`
- H&H International（段永平）：`2018Q4`
- Elliott：`2020Q1`

## Treemap 热度计算

Treemap 方块面积来自热度分数，构成权重如下：

- 覆盖机构数：`0.3`
- 全机构平均权重：`0.4`
- 聚合市值：`0.3`

此外还做了非线性对比增强，便于视觉区分。

## Institution Style 分类说明

风格雷达采用 7 个桶：

- `technology`
- `financials`
- `consumer`
- `healthcare`
- `industrials`
- `energy`
- `other`

分类链路（从高到低）包括：

1. ticker 直接映射（`STYLE_BUCKET_BY_TICKER`）
2. CUSIP / issuer -> ticker 解析与回填
3. 发行人文本关键词兜底分类
4. 宽基 ETF（如 SPY/IVV）按 S&P 500 基准权重拆分到各风格桶
5. 对明显债券/票据类条目（NOTE/BOND/LOAN 等）不计入风格分母

这套逻辑用于降低 SEC 原始命名差异造成的 `Other` 异常偏高。

## 本地启动

```bash
git clone https://github.com/Sunny-1991/13F-Tracker.git
cd 13F-Tracker
./start-site.sh 9012
```

打开：

- `http://127.0.0.1:9012/`

换端口示例：

```bash
./start-site.sh 9010
```

## 数据更新脚本

在项目根目录执行：

```bash
cd 13F-Tracker
```

拉取完整历史：

```bash
python3 scripts/fetch_sec_13f_history.py
```

拉取最新快照：

```bash
python3 scripts/fetch_sec_13f_latest.py
```

可选增强步骤（ticker / shares 辅助处理）：

```bash
python3 scripts/enrich_sec_13f_holdings.py
```

## 目录结构

```text
guru-13f-monitor/
  index.html
  app.js
  styles.css
  start-site.sh
  data/
    sec-13f-history.json
    sec-13f-latest.json
  scripts/
    fetch_sec_13f_history.py
    fetch_sec_13f_latest.py
    enrich_sec_13f_holdings.py
  assets/
    avatars/
```

## 常见问题

- 页面没更新：
  - 浏览器强刷（macOS：`Cmd + Shift + R`）
  - 检查 `index.html` 里资源版本参数是否变化
- 打开的不是当前项目：
  - 确认服务从本项目目录启动
  - 确认 URL 与端口一致
- SEC 拉取失败或限流：
  - 稍等后重试脚本

## 说明

- 13F 属于申报数据，天然存在披露时滞，不等于实时仓位。
- 历史披露格式差异很大（ticker 缺失、命名漂移、类别噪声等）。
- 当前前端已做较强归一化，但随着新披露出现，映射规则仍可能需要持续补充。
