Source and backup data live in this directory. The Vite app reads runtime CSV files from `public/data/`, not from here.

- `aqi_monthly_new.xlsx`: source Excel for monthly data.
- `aqi_daily_new.csv`: OCR output backup for daily data.
- `daily capture/`: screenshots used by `npm run convert:daily`.

Run `npm run convert:monthly` to convert `data/aqi_monthly_new.xlsx` into `public/data/aqi_monthly.csv`.
Run `npm run convert:daily` to merge newly parsed screenshots into `data/aqi_daily_new.csv` by `city + date`, then sync the merged result to `public/data/aqi_daily.csv`. Existing rows stay in the CSV even after older screenshots are archived.
