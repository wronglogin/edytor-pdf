# Edytor PDF

Edytor PDF działający w całości w przeglądarce. Pliki nie są nigdzie wysyłane.

**Adres:** https://wronglogin.github.io/edytor-pdf/

## Co potrafi
- edycja istniejącego tekstu (z rozpoznawaniem czcionki, pogrubienia i kursywy), OCR skanów
- dodawanie tekstu (także w ramce z dopasowaniem rozmiaru), zakreślanie, rysowanie, kształty
- podpisy (rysowane lub z obrazka, zapamiętywane na urządzeniu), obrazy
- obracanie, przestawianie, usuwanie i łączenie stron, drukowanie
- instalacja jako aplikacja (Chrome/Edge) i otwieranie plików PDF z systemu

## Aplikacja na Windows i macOS
Instalatory: **[Releases → najnowsza wersja](https://github.com/wronglogin/edytor-pdf/releases/latest)** – `Edytor-PDF-…-win-x64.exe` (Windows) i `Edytor-PDF-…-mac-universal.dmg` (Mac, Intel i Apple Silicon).
Aplikacja działa bez internetu, zapisuje do tego samego pliku i sama znajduje czcionki systemu, Worda/Office i Acrobata (czytane tylko lokalnie).
Nowe wersje edytora pobiera sama; na Windowsie sama się też aktualizuje.
Kod aplikacji: `desktop/` (Electron), budowanie: `.github/workflows/desktop.yml` (uruchamia się po wypchnięciu tagu `v*`).

## Instalacja jako aplikacja z przeglądarki
Otwórz adres w Chrome lub Edge → „Zainstaluj” na pasku edytora (albo ikona instalacji w pasku adresu).
Potem ustaw „Edytor PDF” jako domyślny program dla plików `.pdf`.

## Czcionki i słownik (otwarte licencje)
| Pliki | Co to jest | Licencja |
|---|---|---|
| `fonts/Arimo-*`, `Tinos-*`, `Cousine-*` | zamienniki o tych samych wymiarach co Arial/Helvetica, Times New Roman, Courier New | SIL OFL 1.1 |
| `fonts/Carlito-*`, `Caladea-*` | zamienniki o tych samych wymiarach co Calibri i Cambria | SIL OFL 1.1 |
| `fonts/SourceSans3-*`, `SourceSerif4-*` | Source Sans / Source Serif (Adobe) | SIL OFL 1.1 |
| `fonts/Gelasio-*` | zamiennik o wymiarach Georgii (wersje statyczne wygenerowane z czcionki zmiennej) | SIL OFL 1.1 |
| `fonts/NimbusSansNarrow-*`, `P052-*`, `C059-*`, `URWBookman-*` | zamienniki Arial Narrow / Helvetica Narrow, Palatino / Book Antiqua, Century Schoolbook, Bookman (URW++) | AGPL-3.0 z wyjątkiem pozwalającym osadzać je w dokumentach PDF |
| `fonts/Roboto-*`, `OpenSans-*`, `Lato-*`, `Montserrat-*`, `Poppins-*`, `Inter-*`, `NotoSans-*`, `NotoSerif-*` | oryginały popularnych czcionek otwartych (część to wersje statyczne wygenerowane z czcionek zmiennych) | SIL OFL 1.1 |
| `fonts/DejaVuSans*`, `DejaVuSerif*` | DejaVu | licencja Bitstream Vera / domena publiczna (`fonts/LICENSE-DejaVu.txt`) |
| `dict/pl.aff`, `dict/pl.dic` | słownik polski (Polish Native Lang Project / sjp.pl) | GPL / LGPL / MPL / CC-SA |
| `lib/nspell.js` | nspell – sprawdzanie pisowni (Titus Wormer) | MIT |

Pełne teksty licencji: `fonts/LICENSE-*`, `dict/LICENSE.txt`, nagłówek `lib/nspell.js`.
