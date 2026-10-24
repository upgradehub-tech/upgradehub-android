# UpgradeHub — Day 9: Admin + Device Layer
Branch: `feature/day-9-admin-device` (dono repos: web + android)

Architecture rule jo follow hua: **Supabase = source of truth** (auth, roles, data, device tokens, notification log).
**Firebase sirf** FCM (push delivery), Analytics, Crashlytics.

## 1. Kya bana

| Module | Web (Next.js + Supabase) | Android (Kotlin) |
|---|---|---|
| Admin authorization | `user_roles` table (clients write nahi kar sakte), `is_admin()` SQL fn, `requireAdmin()` server gate, har table par RLS | -- (neeche Findings #1) |
| Announcement / Syllabus paths | `/api/admin/announcements` (GET/POST/PATCH/DELETE), `/api/admin/syllabus`, `/admin` panel, audit log | -- |
| Device layer | `/api/devices/register`, `device_tokens`, FCM dispatcher, cron retry | FCM service, token registry -> Supabase, widget auto-refresh (30 min), WorkManager |
| 30s alert banner + snooze | -- | Banner pe **Snooze 5 min** (max 3/slot/din), **Snooze test (10s)** button |
| Ambient focus + haptics | -- | Ambient brown-noise (offline, asset-free) + volume, Haptics toggle (channel-level bhi) |
| Duplicate control | `unique(user_id, dedupe_key)`, idempotent enqueue, claim-before-send | `SlotAlertGuard` (ticker+worker+snooze+FCM), notification tag = dedupe_key |

## 2. File structure (sirf naye/badle hue)

```
WEB (upgradehub/)
├─ supabase/migrations/002_admin_device_layer.sql      NEW
├─ lib/auth/server.ts          requireUser / requireAdmin / writeAudit        NEW
├─ lib/http.ts                 jsonError, size-limited readJson               NEW
├─ lib/admin/validators.ts     input whitelist validators                     NEW
├─ lib/notifications/dedupe.ts dedupe key + RecentKeyGuard                    NEW
├─ lib/notifications/fcm.ts    FCM dispatcher (SERVER ONLY, service_role)     NEW
├─ app/api/admin/announcements/route.ts                                       NEW
├─ app/api/admin/syllabus/route.ts                                            NEW
├─ app/api/devices/register/route.ts                                          NEW
├─ app/api/internal/notifications/dispatch/route.ts   (CRON_SECRET)           NEW
├─ app/admin/page.tsx, components/admin/AdminPanel.tsx                        NEW
├─ tests/validators.test.ts, tests/dedupe.test.ts                             NEW
├─ scripts/regression-check.mjs                                               NEW
├─ vercel.json (daily retry cron)                                             NEW
└─ package.json, .env.example, .github/workflows/ci.yml                       MOD

ANDROID (app/src/main/java/com/example/)
├─ device/  SlotAlertGuard, SnoozePolicy(+Tracker), SnoozeScheduler, DeviceFeedbackPrefs,
│           HapticsController, AmbientFocusPlayer, DeviceLayer, DeviceAnalytics,
│           SupabaseDeviceRegistry(+DeviceTokenSyncWorker)                    NEW
├─ device/fcm/ UpgradeHubMessagingService, AnnouncementNotifier               NEW
├─ widget/  NextSlotResolver, WidgetRefreshWorker(+Scheduler)                 NEW
├─ ui/components/AmbientFocusHapticsCard.kt                                   NEW
├─ ui/components/NotificationCenterDialog.kt   guard, snooze btn, haptics, channels   MOD
├─ ui/components/ScheduledStudySlotsEmergencyDrillSection.kt  (+card, 3 lines)        MOD
├─ work/StudySlotWorkScheduler.kt, StudySlotAlarmWorker.kt                    MOD
├─ widget/UpgradeHubStreakWidgetProvider.kt    (+updateNextSlot, onEnabled/Disabled)   MOD
├─ MainActivity.kt (+1 line: DeviceLayer.initialize)                          MOD
└─ AndroidManifest.xml, app/build.gradle.kts, gradle/libs.versions.toml, .env.example  MOD
   test/.../device/ SlotAlertGuardTest, SnoozePolicyTest, NextSlotResolverTest  NEW
```

## 3. Commit karna (apni repo mein)

```bash
# WEB repo
git checkout -b feature/day-9-admin-device
git am < patches/web-day9.patch          # ya web/ folder ki files copy karo
npm install                               # firebase-admin + tsx aayenge
npm run verify                            # typecheck + test + regression

# ANDROID repo
git checkout -b feature/day-9-admin-device
git am < patches/android-day9.patch
```
(`git am` ke baad author badalna ho: `git rebase -r main --exec "git commit --amend --reset-author --no-edit"`)

## 4. Migration steps (is order mein)

1. **Supabase SQL**: Dashboard -> SQL Editor -> `002_admin_device_layer.sql` paste -> Run.
   Phir audit: `select tablename, rowsecurity from pg_tables where schemaname='public';` -> sab `true`.
2. **Pehla admin banao** (SQL Editor; `<UUID>` = Authentication -> Users se apna id):
   `insert into public.user_roles (user_id, role) values ('<UUID>','admin') on conflict (user_id) do update set role='admin';`
3. **Firebase** (sirf push/analytics ke liye): Firebase Console -> Android app add karo, package `com.aistudio.usointeractive.kmpq`
   -> `google-services.json` ko `app/` mein rakho. Project settings -> Cloud Messaging: **FCM API (V1) enabled**.
   Service accounts -> *Generate new private key* -> JSON.
4. **Vercel env vars** (sab *server only*, `NEXT_PUBLIC_` mat lagana):
   `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` (poora JSON, ek line), `CRON_SECRET` (random 32+ chars).
   Pehle se: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
5. **Deploy** web (push -> Vercel). `vercel.json` daily cron failed pushes retry karta hai (Hobby plan par daily hi allowed).
6. **Android**: `.env` mein `UPGRADEHUB_API_BASE_URL=https://<tumhara-domain>` (https zaroori, http reject hota hai).
   Crashlytics ke liye Gradle plugin `com.google.firebase.crashlytics` add karo (version Firebase docs se check karo).
7. **Token registration chalu karna**: Android abhi Firebase Auth use karta hai, Supabase session nahi. Jab Supabase login aaye:
   `SupabaseDeviceRegistry.sessionProvider = SupabaseSessionProvider { /* supabase access token */ }`
   Tab tak token "pending" rehta hai (loss nahi), login ke baad auto sync hota hai.

## 5. Verification — kya CHALA aur kya NAHI

Chala (is sandbox mein, real):
- Web unit tests: **12/12 pass** (validators, mass-assignment drop, dedupe keys, guard window/eviction).
- Web regression script: **43/43 pass** (Day 1-8 modules maujood, har table par RLS, anon revoked, koi `using(true)`,
  service_role sirf `fcm.ts` mein, client files mein secret nahi, har admin mutation `requireAdmin` se, cron secret timing-safe).
- Kotlin pure logic (SlotAlertGuard / SnoozePolicy / NextSlotResolver): same test cases ka JS port, **sab pass**.
- Syntax: sab TS files OK; sab touched Kotlin files mein braces/parens balanced.

NAHI chala (yahan network/Android SDK nahi tha) — push se pehle karo:
- `npm install && npm run verify && npm run build`
- Android: `./gradlew testDebugUnitTest assembleDebug` (compile pehli baar yahin hoga)
- SQL real DB par, FCM live delivery, widget/alarm real device par.

## 6. Manual device QA checklist

1. **Snooze test**: Dashboard -> Study Environment -> *Snooze test (10s)*. Expect: alarm + banner, 3s baad band, ~10s baad dobara bajta hai (ek hi baar).
2. **Snooze limit**: real slot par 3 baar Snooze -> chauthi baar toast "Snooze limit reached".
3. **Duplicate**: slot time ko ~2 min aage set karo, app **khuli** rakho -> ek hi baar bajna chahiye (ticker + worker dono). Phir app kill karke dobara slot -> ek baar (worker).
4. **Disabled slot**: slot toggle off -> us time par kuch nahi bajna chahiye.
5. **Haptics off**: toggle off -> drill + notification dono bina vibration. On -> vibration.
6. **Ambient**: on -> noise; alarm ke dauran pause, alarm ke baad resume; volume slider kaam kare.
7. **Widget**: home screen par add -> "Next: ..." dikhe, slot edit ke baad <=30 min mein update.
8. **Push**: admin panel se draft -> Publish -> phone par ek notification. Dobara Publish -> koi naya nahi (queued = 0).

## 7. Findings (purane code mein mile)

1. **Android admin gate client-side hai**: `AdminControlPortalScreen` role string + **hardcoded email** (`prince339569@gmail.com`) se kholta hai.
   Ye UI-hint hai, security nahi; asli enforcement ab server+RLS mein hai (web). Android portal ko `/api/admin/*` par shift karna Day 10 ka kaam hai. Maine ise **badla nahi**.
2. **Bug (fixed)**: `ensureInitialized()` har process start par saare slots `REPLACE` karta tha — worker chalte waqt khud ko cancel kar sakta tha. Ab `KEEP`.
3. **Bug (fixed)**: worker disabled slot par bhi bajta tha; `isEnabled` prefs se load hi nahi hota tha (restart par sab "on"). Ab dono theek.
4. **Bug (fixed)**: ticker + worker dono ek hi slot par bajte the (audio/vibration double). Ab ek guard.
5. **Baaki**: do slots same minute par ho to sirf pehla bajta hai (`firstOrNull`); `stopMockDrillAudio` sirf slot 0-3 ki notification cancel karta hai.
6. Rate limit (AI coach + admin) in-memory hai (serverless par best-effort) — heavy traffic ke liye Upstash/Vercel KV.
7. Audience `batch/no_batch` abhi sirf store hota hai; targeting (kis user ko bhejna) Day 10.
