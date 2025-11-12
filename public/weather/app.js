const API_KEY = "YOUR_API_KEY_HERE"; // TODO: 替换为你的 OpenWeatherMap API Key
const BASE_URL = "https://api.openweathermap.org/data/2.5/";
const DEFAULT_CITY = "北京";

const dom = {
  searchInput: document.querySelector("#city-input"),
  searchBtn: document.querySelector("#search-btn"),
  temp: document.querySelector("[data-temp]"),
  feels: document.querySelector("[data-feels]"),
  humidity: document.querySelector("[data-humidity]"),
  wind: document.querySelector("[data-wind]"),
  pressure: document.querySelector("[data-pressure]"),
  city: document.querySelector("[data-city]"),
  description: document.querySelector("[data-description]"),
  updateTime: document.querySelector("[data-update-time]"),
  icon: document.querySelector("[data-icon]"),
  forecast: document.querySelector("[data-forecast]"),
  card: document.querySelector(".weather-card"),
  background: document.querySelector(".background-layer"),
};

const themeByWeather = {
  Clear: {
    gradient: "linear-gradient(135deg, #f9d423 0%, #ff4e50 100%)",
    accent: "#ffd166",
  },
  Clouds: {
    gradient: "linear-gradient(135deg, #5b86e5 0%, #7aa1f2 100%)",
    accent: "#a5bff3",
  },
  Rain: {
    gradient: "linear-gradient(140deg, #373b44 0%, #4286f4 100%)",
    accent: "#7fd1ff",
  },
  Drizzle: {
    gradient: "linear-gradient(140deg, #485563 0%, #29323c 100%)",
    accent: "#b3c7d6",
  },
  Thunderstorm: {
    gradient: "linear-gradient(140deg, #141e30 0%, #243b55 100%)",
    accent: "#f6bd60",
  },
  Snow: {
    gradient: "linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)",
    accent: "#f1f5f9",
  },
  Mist: {
    gradient: "linear-gradient(135deg, #606c88 0%, #3f4c6b 100%)",
    accent: "#cbd5f5",
  },
};

const iconByCondition = {
  day: {
    Clear: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#ffd166" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="12"/><path d="M32 8v6M32 50v6M8 32h6M50 32h6M14.93 14.93l4.24 4.24M44.83 44.83l4.24 4.24M14.93 49.07l4.24-4.24M44.83 19.17l4.24-4.24"/></g></svg>`,
    Clouds: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M25 48h22a11 11 0 1 0-2.23-21.82 15 15 0 0 0-28 5.82A10 10 0 0 0 25 48z" fill="#dbeafe" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/></svg>`,
    Rain: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M22 47h22a11 11 0 1 0-2.23-21.82 15 15 0 0 0-28 5.82A10 10 0 0 0 22 47z" fill="#1d4ed8" opacity=".85" stroke="#bfdbfe" stroke-width="3"/><line x1="22" y1="52" x2="18" y2="60" stroke="#90cdf4" stroke-width="3" stroke-linecap="round"/><line x1="32" y1="52" x2="28" y2="60" stroke="#90cdf4" stroke-width="3" stroke-linecap="round"/><line x1="42" y1="52" x2="38" y2="60" stroke="#90cdf4" stroke-width="3" stroke-linecap="round"/></svg>`,
    Drizzle: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M24 46h22a11 11 0 1 0-2.23-21.82A15 15 0 0 0 16 30a10 10 0 0 0 8 16z" fill="#60a5fa" stroke="#eff6ff" stroke-width="3"/><line x1="24" y1="50" x2="22" y2="56" stroke="#bfdbfe" stroke-width="3" stroke-linecap="round"/><line x1="34" y1="50" x2="32" y2="56" stroke="#bfdbfe" stroke-width="3" stroke-linecap="round"/><line x1="44" y1="50" x2="42" y2="56" stroke="#bfdbfe" stroke-width="3" stroke-linecap="round"/></svg>`,
    Thunderstorm: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M20 46h22a11 11 0 1 0-2.23-21.82A15 15 0 0 0 12 30a10 10 0 0 0 8 16z" fill="#1f2937" stroke="#facc15" stroke-width="3"/><polyline points="30 36 24 50 34 50 28 62" fill="none" stroke="#fde68a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    Snow: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M23 47h22a11 11 0 1 0-2.23-21.82A15 15 0 0 0 15 31a10 10 0 0 0 8 16z" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/><g stroke="#94a3b8" stroke-width="3" stroke-linecap="round"><line x1="24" y1="52" x2="22" y2="58"/><line x1="30" y1="52" x2="28" y2="58"/><line x1="36" y1="52" x2="34" y2="58"/><line x1="42" y1="52" x2="40" y2="58"/></g></svg>`,
    Mist: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#cbd5f5" stroke-width="4" stroke-linecap="round"><path d="M14 24h36"/><path d="M10 32h44"/><path d="M14 40h36"/><path d="M18 48h28"/></g></svg>`,
  },
  night: {
    Clear: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M46 17a18 18 0 1 1-23 23 15 15 0 1 0 23-23z" fill="#fde68a" stroke="#fbbf24" stroke-width="3"/><circle cx="20" cy="20" r="2.5" fill="#fcd34d"/><circle cx="16" cy="30" r="1.8" fill="#fcd34d"/><circle cx="26" cy="14" r="1.5" fill="#fcd34d"/></svg>`,
    Clouds: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M25 48h22a11 11 0 1 0-2.23-21.82 15 15 0 0 0-28 5.82A10 10 0 0 0 25 48z" fill="#1e293b" stroke="#e2e8f0" stroke-width="3"/></svg>`,
    Rain: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M24 46h22a11 11 0 1 0-2.23-21.82A15 15 0 0 0 16 30a10 10 0 0 0 8 16z" fill="#1e293b" stroke="#38bdf8" stroke-width="3"/><g stroke="#bae6fd" stroke-width="3" stroke-linecap="round"><line x1="24" y1="52" x2="20" y2="60"/><line x1="34" y1="52" x2="30" y2="60"/><line x1="44" y1="52" x2="40" y2="60"/></g></svg>`,
    Drizzle: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M22 46h22a11 11 0 1 0-2.23-21.82A15 15 0 0 0 14 30a10 10 0 0 0 8 16z" fill="#1f2937" stroke="#e2e8f0" stroke-width="3"/><g stroke="#94a3b8" stroke-width="3" stroke-linecap="round"><line x1="24" y1="50" x2="22" y2="56"/><line x1="34" y1="50" x2="32" y2="56"/><line x1="44" y1="50" x2="42" y2="56"/></g></svg>`,
    Thunderstorm: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M18 46h22a11 11 0 1 0-2.23-21.82A15 15 0 0 0 10 30a10 10 0 0 0 8 16z" fill="#111827" stroke="#fde047" stroke-width="3"/><polyline points="28 36 22 50 32 50 26 62" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    Snow: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M22 46h22a11 11 0 1 0-2.23-21.82A15 15 0 0 0 14 30a10 10 0 0 0 8 16z" fill="#1f2937" stroke="#e2e8f0" stroke-width="3"/><g stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"><line x1="24" y1="52" x2="22" y2="58"/><line x1="30" y1="52" x2="28" y2="58"/><line x1="36" y1="52" x2="34" y2="58"/><line x1="42" y1="52" x2="40" y2="58"/></g></svg>`,
    Mist: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#cbd5f5" stroke-width="4" stroke-linecap="round"><path d="M12 24h40"/><path d="M10 32h44"/><path d="M12 40h40"/><path d="M16 48h32"/></g></svg>`,
  },
};

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function getIcon(main, isDaytime) {
  const conditionKey = normalizeCondition(main);
  const collection = iconByCondition[isDaytime ? "day" : "night"];
  return collection[conditionKey] ?? collection.Clouds;
}

function normalizeCondition(main) {
  if (["Thunderstorm"].includes(main)) return "Thunderstorm";
  if (["Drizzle"].includes(main)) return "Drizzle";
  if (["Rain"].includes(main)) return "Rain";
  if (["Snow"].includes(main)) return "Snow";
  if (["Mist", "Smoke", "Haze", "Dust", "Fog", "Sand", "Ash"].includes(main)) return "Mist";
  if (["Squall", "Tornado"].includes(main)) return "Thunderstorm";
  if (["Clear"].includes(main)) return "Clear";
  return "Clouds";
}

function applyTheme(main) {
  const condition = normalizeCondition(main);
  const theme = themeByWeather[condition] ?? themeByWeather.Clouds;
  document.documentElement.style.setProperty("--background-gradient", theme.gradient);
  document.documentElement.style.setProperty("--accent", theme.accent);
  dom.background.style.opacity = "0.9";
}

async function fetchCurrentWeather(city) {
  const url = `${BASE_URL}weather?q=${encodeURIComponent(
    city.trim()
  )}&appid=${API_KEY}&units=metric&lang=zh_cn`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("无法获取该城市的天气信息，请检查输入是否正确。");
  }
  return response.json();
}

async function fetchForecast(city) {
  const url = `${BASE_URL}forecast?q=${encodeURIComponent(
    city.trim()
  )}&appid=${API_KEY}&units=metric&lang=zh_cn`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("无法获取该城市的天气预报。");
  }
  return response.json();
}

function renderCurrentWeather(data) {
  const {
    name,
    weather: [{ main, description, icon }],
    main: { temp, feels_like, humidity, pressure },
    wind: { speed },
    dt,
    sys: { country, sunrise, sunset },
  } = data;

  const isDaytime = dt >= sunrise && dt <= sunset;
  const iconMarkup = getIcon(main, isDaytime);

  dom.temp.textContent = Math.round(temp);
  dom.feels.textContent = `${Math.round(feels_like)} °C`;
  dom.humidity.textContent = `${Math.round(humidity)} %`;
  dom.wind.textContent = `${(speed * 3.6).toFixed(1)} km/h`;
  dom.pressure.textContent = `${pressure} hPa`;
  dom.city.textContent = `${name}${country ? `，${country}` : ""}`;
  dom.description.textContent = description;
  dom.updateTime.textContent = dateTimeFormatter.format(new Date());
  dom.icon.innerHTML = iconMarkup;

  dom.icon.style.opacity = "0";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dom.icon.style.opacity = "1";
      dom.icon.style.transform = "translateY(0)";
    });
  });

  applyTheme(main);
}

function groupForecastByDay(list, timezoneOffset) {
  const byDay = new Map();

  for (const entry of list) {
    const localTimestamp = (entry.dt + timezoneOffset) * 1000;
    const date = new Date(localTimestamp);
    const isoDate = date.toISOString().split("T")[0];
    const currentBest = byDay.get(isoDate);
    if (!currentBest) {
      byDay.set(isoDate, entry);
      continue;
    }
    const currentDiff = Math.abs(new Date((currentBest.dt + timezoneOffset) * 1000).getHours() - 12);
    const contenderDiff = Math.abs(date.getHours() - 12);
    if (contenderDiff < currentDiff) {
      byDay.set(isoDate, entry);
    }
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .slice(0, 5)
    .map(([, value]) => value);
}

function renderForecast(data) {
  const { list, city } = data;
  const timezoneOffset = city.timezone ?? 0;
  const daily = groupForecastByDay(list, timezoneOffset);

  dom.forecast.innerHTML = "";

  daily.forEach((entry, index) => {
    const localDate = new Date((entry.dt + timezoneOffset) * 1000);
    const dayLabel =
      index === 0 ? "今天" : index === 1 ? "明天" : weekdayFormatter.format(localDate);
    const condition = entry.weather[0];
    const isDaytime = isForecastDaytime(localDate);
    const iconMarkup = getIcon(condition.main, isDaytime);

    const card = document.createElement("article");
    card.className = "forecast-card";
    card.innerHTML = `
      <span class="day">${dayLabel}</span>
      <div class="icon">${iconMarkup}</div>
      <div class="temps">
        <span><strong>${Math.round(entry.main.temp)}°</strong><small>平均</small></span>
        <span>${Math.round(entry.main.temp_min)}° / ${Math.round(entry.main.temp_max)}°</span>
      </div>
      <div class="meta">
        <span>${condition.description}</span>
        <span>湿度 ${entry.main.humidity}% · 风 ${(entry.wind.speed * 3.6).toFixed(1)} km/h</span>
      </div>
    `;
    dom.forecast.append(card);
  });
}

function isForecastDaytime(date) {
  const hour = date.getHours();
  return hour >= 6 && hour <= 18;
}

async function loadWeather(city) {
  if (!city) {
    shakeInput();
    return;
  }

  setLoadingState(true);
  try {
    const [current, forecast] = await Promise.all([
      fetchCurrentWeather(city),
      fetchForecast(city),
    ]);
    renderCurrentWeather(current);
    renderForecast(forecast);
    localStorage.setItem("last_city", current.name);
  } catch (error) {
    presentError(error.message);
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(isLoading) {
  dom.searchBtn.disabled = isLoading;
  dom.card.classList.toggle("is-loading", isLoading);
  dom.searchBtn.setAttribute("aria-busy", isLoading.toString());
  if (isLoading) {
    dom.searchBtn.classList.add("spinning");
  } else {
    dom.searchBtn.classList.remove("spinning");
  }
}

function shakeInput() {
  dom.searchInput.classList.add("shake");
  setTimeout(() => dom.searchInput.classList.remove("shake"), 500);
  dom.searchInput.focus();
}

function presentError(message) {
  dom.description.textContent = message;
  dom.icon.innerHTML = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="rgba(148, 163, 184, 0.25)" stroke="#fca5a5" stroke-width="4"/>
    <line x1="24" y1="24" x2="40" y2="40" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
    <line x1="40" y1="24" x2="24" y2="40" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
  dom.forecast.innerHTML = "";
  applyTheme("Mist");
}

function bindEvents() {
  dom.searchBtn.addEventListener("click", () => {
    loadWeather(dom.searchInput.value);
  });

  dom.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadWeather(dom.searchInput.value);
    }
  });
}

function init() {
  if (API_KEY === "YOUR_API_KEY_HERE") {
    console.warn("请先在 public/weather/app.js 中替换 API_KEY。");
    dom.description.textContent = "请先在 app.js 中配置你的 OpenWeatherMap API Key。";
  }

  bindEvents();

  const lastCity = localStorage.getItem("last_city");
  const initialCity = lastCity || DEFAULT_CITY;
  dom.searchInput.value = initialCity;
  loadWeather(initialCity);
}

document.addEventListener("DOMContentLoaded", init);
