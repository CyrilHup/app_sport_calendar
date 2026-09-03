# 🏔️ QMT-80 Performance Hub

> **Dynamic Ultra-Trail Periodization, Academic Schedule Synchronization & Garmin Connect Telemetry Engine**

[![React](https://img.shields.io/badge/React-18-blue.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-purple.svg?logo=vite)](https://vitejs.dev/)
[![iCalendar](https://img.shields.io/badge/RFC_5545-Compliant-success.svg)](https://datatracker.ietf.org/doc/html/rfc5545)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Overview

**QMT-80 Performance Hub** is an elite endurance sports and schedule orchestration system built for student-athletes preparing for major ultra-trail events (such as the **Québec Mega Trail 80 km** with 4,000m D+).

It automatically bridges academic course timetables, daily transit commutes, and high-volume training blocks into an intelligent calendar schedule, directly compared against real-world **Garmin Connect** telemetry.

---

## ✨ Core Features

### 1. 🏔️ Ultra-Trail Periodization Architecture (QMT-80)
- **Phased Periodization Matrix:** Covers the full build from post-season foundation ramp-up (55% ➔ 75% ➔ 90% volume) through winter incline treadmill power blocks, spring back-to-back weekend shocks, technical terrain peak blocks, and pre-race tapering.
- **Physiological Target Ranges:** Calibrated for endurance athletes ($FC_{max} = 203\text{ bpm}$) with strict cardio boundaries (Zone 2 aerobic base $< 155\text{ bpm}$, Zone 4/5 hill climb threshold $172\text{--}190\text{ bpm}$).
- **Elevation & Biomechanics Targets:** Prescribes specific elevation gain targets ($+380\text{m}$ to $+1,100\text{m}$ D+), optimal cadence ($170\text{--}175\text{ spm}$), and hourly carbohydrate/hydration fueling strategies.

### 2. 🏛️ Dynamic Academic Schedule & Smart Commutes
- **Universal iCal Parsing:** Parses any university or corporate iCalendar (`.ics`) feed with timezone conversion and conflict resolution.
- **Distance / Online Detection:** Automatically flags online distance learning (`[ONLINE]`) to prevent unnecessary commute generation.
- **Automated Transit Chaining:** Calculates door-to-door transit times (bus/metro) with safety arrival buffers ($10\text{ min}$) and handles direct gym/training transitions post-class.

### 3. ⌚ Garmin Connect Telemetry & "Other" Profile Signature Matcher
- **Full Support for the "Other" Profile:** Athletes frequently log custom or indoor workouts under Garmin's generic `OTHER` category. The engine automatically classifies them through **physiological signature analysis**:
  - $D+ > 80\text{m}$ or hill keywords ➔ Inferred as *Trail / Hill Repeats*
  - Average $HR > 165\text{ bpm}$ ➔ Inferred as *High-Intensity Cardio*
  - Measured cadence $> 150\text{ spm}$ ➔ Inferred as *Aerobic Base Running*
  - Low distance with duration 30–70 min ➔ Inferred as *Calisthenics / Strength*
- **Timeline Filtering:** Evaluates workouts **from the current date going back into the past**, preventing future unreached workouts from being marked as missed.
- **Detailed Compliance Breakdown:** Computes duration variance, heart rate zone adherence, elevation gain delta, and provides coach diagnostics.

### 4. 📅 Direct Google Calendar Synchronization (Zero Google Apps Script)
- **1-Click .ICS File Export:** Instant download of RFC 5545 compliant `.ics` calendar files ready to import directly into Google Calendar in seconds.
- **Live Subscription Feed (`/api/calendar.ics`):** Real-time subscription endpoint for Google Calendar, Apple Calendar, or mobile devices ("Add from URL").
- **Direct Google Calendar API (OAuth 2.0):** Optional direct push into primary Google Calendar with color-coding and automatic event update mapping.

### 5. 📊 High-Density Pro Athlete Telemetry
- Clean, compact metrics layout inspired by **Intervals.icu** and **Strava Pro Analytics**.
- No bulky floating cards or AI templates: sleek tabular alignment (`tabular-nums`), interactive filters, and unified weekly volume/elevation telemetry progress bars.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/CyrilHup/app_sport_calendar.git
cd app_sport_calendar
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy the example environment template:
```bash
cp .env.example .env
```

Open `.env` and fill in your personal configuration:
```env
# Academic / Corporate iCal Feed URL
VITE_ICAL_FEED_URL="https://your-university.edu/calendar/feed?token=YOUR_TOKEN"

# Addresses for Automated Commute Calculations
VITE_HOME_ADDRESS="123 Main Street, City, State, Country"
VITE_CAMPUS_ADDRESS="456 University Boulevard, City, State, Country"
VITE_TRAIL_LOCATION="Mountain Trail Park"
VITE_TRAIL_ADDRESS="Mountain Trail Park, City, State, Country"

# Target Race Settings
VITE_TARGET_RACE_NAME="Québec Mega Trail 80 km"
VITE_TARGET_RACE_DATE="2027-07-03"
VITE_PLAN_START_DATE="2027-01-11"
VITE_SPORT_START_DATE="2026-09-01"

# Athlete Profile
VITE_ATHLETE_FC_MAX=203
```

### 4. Run development server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

---

## 🔒 Privacy & Anonymization

This repository is strictly designed to be open-source and privacy-compliant:
- **Zero hardcoded credentials:** All personal addresses, school tokens, and account identifiers are externalized to `.env`.
- **Git protection:** `.env` and local credential files are explicitly ignored in `.gitignore`.
- **Configurable for any athlete:** Can be adapted to any school, club, or ultra-trail event globally.

---

## 🛠️ Project Structure

```
├── .env.example              # Public configuration template
├── .gitignore                # Git exclusions (protects .env and secrets)
├── index.html                # Main HTML entry point
├── package.json              # Dependencies and build scripts
├── vite.config.ts            # Vite configuration with iCal & Webcal middleware
├── src/
│   ├── App.tsx               # Main application coordinator
│   ├── main.tsx              # React DOM entry
│   ├── components/
│   │   ├── Header.tsx                 # Pro telemetry strip, live sync & date toggle
│   │   ├── CalendarView.tsx           # 7-day responsive grid & detailed list
│   │   ├── WeatherWidget.tsx          # Mont-Royal live weather & gear advisory
│   │   ├── ComparisonDashboard.tsx    # Garmin telemetry table, status filters & manual pairing
│   │   ├── TrainingLoadCard.tsx       # Weekly volume & Training Stress Score (TSS) telemetry
│   │   ├── GoogleCalendarModal.tsx    # Direct sync, 1-click import & feed subscription
│   │   ├── GarminModal.tsx            # Garmin Connect sync & GPX file import
│   │   ├── WorkoutDetailModal.tsx     # Session protocol, fueling calculator & gear checklist
│   │   ├── QMTPlanOverview.tsx        # 6-phase periodization matrix & race strategy
│   │   └── MobileNav.tsx              # Responsive bottom navigation bar
│   ├── services/
│   │   ├── icsParser.ts               # RFC 5545 parser & automated smart commute generator
│   │   ├── weatherService.ts          # Open-Meteo meteorological client & trail conditions
│   │   ├── periodizationEngine.ts     # QMT-80 periodization matrix & target builder
│   │   ├── garminService.ts           # Garmin Connect integration & GPX parser
│   │   ├── comparisonEngine.ts        # Telemetry comparison & signature matcher
│   │   └── googleCalendarService.ts   # Google Calendar REST API & ICS export
│   ├── styles/
│   │   └── index.css                  # High-density sports telemetry design system
│   └── types/
│       ├── calendar.ts                # Domain interfaces (events, templates, phases)
│       └── garmin.ts                  # Garmin telemetry interfaces & comparison statuses
```

---

## 📜 License

Distributed under the **MIT License**. Free for personal and athletic use.
