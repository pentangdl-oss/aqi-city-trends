# 中国城市 AQI 趋势图

一个用于展示中国城市 AQI 与污染物趋势的 React + Vite 页面。城市列表和时间范围会从 `public/data/` 下的运行时 CSV 自动读取。

## 功能

- 城市多选：自动读取 CSV 中的城市
- 时间范围筛选：自动读取 CSV 中的最早和最晚月份
- 指标切换：AQI、PM2.5、PM10、O3、NO2、SO2、CO
- 月度趋势和日度趋势
- ECharts 折线图、图例、hover tooltip
- AQI 图表参考线：50、100、150、200、300
- 导出当前图表 PNG
- 下载当前筛选后的 CSV

## 安装依赖

```bash
npm install
```

## 运行项目

```bash
npm run dev
```

默认开发服务由 Vite 启动。终端会显示本地访问地址。

## 构建

```bash
npm run build
```

## 数据文件

页面从 Vite 静态目录读取数据：

- `public/data/aqi_daily.csv`
- `public/data/aqi_monthly.csv`

字段说明：

| 字段 | 说明 |
| --- | --- |
| `city` | 城市名 |
| `date` | 日期，格式 `YYYY-MM-DD`，仅日度 CSV 使用 |
| `month` | 月份，格式 `YYYY-MM`，仅月度 CSV 使用 |
| `AQI` | 空气质量指数 |
| `PM2.5` | PM2.5 浓度 |
| `PM10` | PM10 浓度 |
| `SO2` | SO2 浓度 |
| `NO2` | NO2 浓度 |
| `CO` | CO 浓度 |
| `O3` | O3 或 O3_8h 指标 |
| `O3_8h` | O3 8 小时指标 |
| `quality_level` | 空气质量等级 |

## 生成示例数据

当前项目仍保留 mock 数据生成脚本，主要用于没有真实 Excel 时快速恢复示例数据：

```bash
npm run mock:data
```

这个脚本会覆盖：

- `public/data/aqi_daily.csv`
- `public/data/aqi_monthly.csv`

## 从 Excel 更新月度 CSV

把新版 Excel 放到：

```text
data/aqi_monthly_new.xlsx
```

然后运行：

```bash
npm run convert:monthly
```

这个命令会把 `data/aqi_monthly_new.xlsx` 转换为标准字段，并覆盖：

- `public/data/aqi_monthly.csv`

如果要指定其他输入或输出文件：

```bash
node scripts/convert-monthly-xlsx.js data/aqi_monthly_new.xlsx public/data/aqi_monthly.csv
```

当前转换脚本识别的 Excel 列包括：城市、月份、AQI、质量等级、PM2.5、PM10、SO2、CO、NO2、O3。`O3_8h` 会使用 O3 的同值填充，以保持前端 CSV 字段稳定。

## 从截图更新日度 CSV

把 aqistudy 日度页面截图放到：

```text
data/daily capture/
```

然后运行：

```bash
npm run convert:daily
```

这个命令会用 macOS Vision OCR 识别截图表格，并按 `city + date` 与已有日度 CSV 合并，生成：

- `data/aqi_daily_new.csv`

并同步写入：

- `public/data/aqi_daily.csv`

截图标题需要包含类似 `2025年01月许昌空气质量指数日历史数据` 的城市和月份信息。转换脚本会按每张截图的表头坐标动态识别列顺序，因此可以处理 `NO2/SO2/CO` 或 `CO/NO2/SO2` 等不同列顺序。

已经解析过的截图可以归档。后续运行 `npm run convert:daily` 时，脚本会保留 `data/aqi_daily_new.csv` 里的既有记录，只用当前截图目录里的新数据覆盖或补充相同 `city + date` 的行。

## 更新真实数据

优先数据源为 aqistudy.cn 历史空气质量数据页面：

- `https://www.aqistudy.cn/historydata/`
- `monthdata.php?city=合肥`

可以尝试自动抓取：

```bash
npm run fetch:data
```

可通过环境变量调整城市和月份范围：

```bash
CITIES="合肥,郑州,许昌,常州" START_MONTH=201301 END_MONTH=202605 npm run fetch:data
```

如果网站返回 403、启用反爬、或页面结构变化，请手动从页面复制或下载表格为 CSV，然后运行清洗脚本：

```bash
node scripts/clean-aqi-data.js raw/monthly.csv public/data/aqi_monthly.csv
```

清洗脚本会把常见中文表头整理成页面需要的标准字段。

## 尝试使用 IQAir 数据

IQAir 城市网页有实时空气质量、污染物和历史图，但网页端历史图公开说明通常只覆盖过去 48 小时小时数据、过去 30 天日均数据；更长历史主要来自年度 World Air Quality Report，且重点是 PM2.5，并不能直接替代本项目需要的长时间范围全字段月度 CSV。

项目提供了一个 IQAir API 当前数据脚本：

```bash
IQAIR_API_KEY=your_key npm run fetch:iqair
```

输出：

- `data/iqair_current.csv`
- `public/data/iqair_current.csv`

注意：IQAir Community API 通常只返回城市当前 AQI、AQI_CN、主要污染物和天气字段。PM2.5、PM10、SO2、NO2、CO、O3 浓度以及更长历史数据通常需要更高等级 API 或手动导出。这个脚本适合验证 IQAir 数据接入，不会自动覆盖当前页面使用的运行时 CSV。

## 数据来源与注意事项

数据来源优先使用 aqistudy.cn 的历史空气质量数据页面，或由 `data/aqi_monthly_new.xlsx` 和 `data/aqi_daily_new.csv` 转换得到的本地数据。aqistudy.cn 说明每日和月度 AQI 数据是根据环保总站每小时数据计算平均得到，存在丢数据场景，因此本项目中的数据仅用于趋势参考，不应作为监管、健康诊断或精确统计依据。

本仓库当前运行时 CSV 位于 `public/data/`。后续更新 Excel 后运行 `npm run convert:monthly`，更新截图后运行 `npm run convert:daily`，即可刷新页面数据。
