import React from "react";

export default function CitySelector({ cities, selectedCities, onChange }) {
  function toggleCity(city) {
    const next = selectedCities.includes(city)
      ? selectedCities.filter((item) => item !== city)
      : [...selectedCities, city];
    onChange(next.length ? next : selectedCities);
  }

  return (
    <section className="space-y-2">
      <div className="control-label">城市</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cities.map((city) => (
          <label
            key={city}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
              selectedCities.includes(city)
                ? "border-cyan-700 bg-cyan-50 text-cyan-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedCities.includes(city)}
              onChange={() => toggleCity(city)}
              className="h-4 w-4 accent-cyan-700"
            />
            {city}
          </label>
        ))}
      </div>
    </section>
  );
}
