# Data and storage budget

## Online-first policy

The PWA uses a service worker only for its interface files: HTML, CSS,
JavaScript, manifest, and icons. It **does not cache any `/api/*` response**.
That means question batches, answer reveals, explanations, search results, and
progress requests require the internet and are not silently turned into an
offline question bank.

The only local browser values are small settings such as Data Saver, an
anonymous installation identifier, and the app’s own data-meter total.

## Expected iPad network use

These are implementation targets, not a cellular-carrier measurement. Actual
values depend on source question/explanation length, HTTP compression, and
media that an operator might later add.

| User activity | Typical transfer budget |
| --- | ---: |
| First visit / Add-to-Home-Screen app shell | **2–6 MB** |
| Subject and topic lists | usually **under 1 MB** |
| Initial 10-question text batch | about **50–300 KB** |
| Answer + explanation reveal | commonly **2–30 KB each** |
| 100 answered text questions with explanations | around **0.5–3 MB** |
| Search query/results | commonly **10–200 KB** |
| Image loaded deliberately | commonly **0.1–1.5 MB per image** |
| Streamed video | commonly **5–100+ MB per video** |

The implementation reduces unnecessary transfer in two ways:

1. The initial session endpoint omits keys and explanations.
2. The reveal endpoint supplies one answer/explanation only after a learner
   selects an option.

Data Saver limits the UI to ten-question sessions and disables the larger
20/50-question choices. It does not claim to control iOS background traffic or
future media streams.

## Expected iPad storage

| Item | Expected on-device use |
| --- | ---: |
| Installed app shell/cache | roughly **5–15 MB** |
| Question data cache | **0 MB by service-worker policy** |
| Local preferences/data meter | well under **1 MB** |

Safari can evict its application cache at any time. The server/database, not
the iPad, is the source of truth for questions and progress.

## Server-side planning

The public source repository does not include the MedMCQA dump. The known
source dataset is about 55 MB compressed/downloaded and about 136 MB decoded;
allow approximately **150–300 MB** for the basic Mongo data and normal indexes.
Semantic embedding/index operations may require more server disk/RAM. None of
those assets are transferred to the iPad automatically.

## What the in-app meter means

The Profile screen adds up the decoded JSON body returned from this PWA API.
It intentionally cannot see:

- iOS Settings cellular/Wi-Fi counters;
- HTTP transfer compression at the wire level;
- PWA installation/icon/cache overhead;
- media bytes from a future image/video host; or
- traffic used by other apps/tabs.

Use iPadOS Settings or an MDM/network meter for billing-quality measurements.
