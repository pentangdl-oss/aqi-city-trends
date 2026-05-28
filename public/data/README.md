These CSV files are copied into the production build by Vite.

The app reads these files at runtime:

- `aqi_monthly.csv`
- `aqi_daily.csv`

Source and backup data live in `data/`. Run `npm run convert:monthly`, `npm run convert:daily`, `npm run fetch:data`, or `scripts/clean-aqi-data.js` to refresh these runtime CSV files.
