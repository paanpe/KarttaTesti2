# Copilot-tietoturvatarkastus – KarttaTesti2

**Tarkastuspäivä:** 3.7.2026  
**Repositorio:** paanpe/KarttaTesti2  
**Sovelluksen tyyppi:** Staattinen verkkosovellus (HTML5 + Vanilla CSS + Vanilla JavaScript)

---

## Yhteenveto

KarttaTesti2 on Suomen kansallispuistoista kertova interaktiivinen karttasovellus, joka toimii täysin selaimen puolella. Tarkastuksessa tunnistettiin useita tietoturva- ja best practice -huomioita, joista monet ovat matalia, mutta joitakin tulisi korjata.

---

## Tietoturvahaasteet ja havainnot

### 🔴 Kriittiset ongelmat

#### 1. Kovakoodatut tunnukset ja salasanat
- **Sijainti:** `app.js` (rivit 3–4)
- **Ongelma:** Demo-tunnukset (`retkeilija` / `metsa2026`) ja oletussalasana ovat näkyvissä julkisessa koodissa
- **Riski:** Jokainen voi kirjautua sovellukseen ilman rajoituksia; loukkaako käyttäjän yksityisyyttä
- **Suositus:** 
  - Poista kovakoodatut tunnukset tuotantokoodista
  - Toteuta oikea autentikaatio backendin kanssa (OAuth2, JWT tai vastaava)
  - Jos demo-tilaa tarvitaan, käytä vain kehitysskannukseen tai erillisiä demo-ympäristöjä

#### 2. Riittämätön pääsynvalvonta (Authorization)
- **Ongelma:** Autentikaatio perustuu vain `localStorage`-arvoon (`kp_session`), jota voi muokata selaimessa
- **Riski:** Käyttäjä voi tehdä JavaScript-konsolissa `localStorage.setItem("kp_session", "1")` ja ohittaa kirjautumisen
- **Suositus:**
  - Toteuta server-side session management (tokenit, evästeet)
  - Validoi istunto palvelimella jokaisen merkittävän toiminnon yhteydessä

#### 3. Salasanan tallennus selvätekstissä
- **Sijainti:** `app.js`, rivi 480 (`localStorage.setItem("kp_password", nw)`)
- **Ongelma:** Käyttäjän uusi salasana tallennetaan suoraan `localStorage`-muistiin enkryptoimattomana
- **Riski:** Kuka tahansa, jolla on fyysinen pääsy laitteeseen tai selaimeen, voi lukea salasanan
- **Suositus:**
  - Älä koskaan tallenna salasanoja selaimen puolella
  - Käytä server-side -autentikaatiota ja suojatusti varjotettuja salasanoja (bcrypt, Argon2)

#### 4. XSS-hyökkäysten alttiuden osittainen hallinta
- **Hyvä:** Sovellus käyttää `escapeHtml()` ja `escapeAttr()` -funktioita (rivit 489–492)
- **Huoli:** Kaikki user input -paikat eivät ole hallittuja samalla tavalla
- **Sijainti:** `parks.json` -data asetetaan suoraan HTML:iin, vaikka se on kontrolloimatonta tietoa
- **Riski:** Jos `parks.json` kompromittoidaan tai ladataan väärästä lähteesta, XSS-hyökkäys on mahdollinen
- **Suositus:**
  - Validoi kaikki `parks.json`-data saapuessa
  - Käytä Content Security Policy (CSP) -otsikoita

#### 5. Ulkoisen resurssien riippuvuudet ilman integriteettia
- **Sijainti:** `index.html` (rivit 7–9, 10, 29)
- **Riippuvuudet:**
  - Google Fonts CDN (fonts.googleapis.com)
  - Leaflet CDN (unpkg.com)
  - CARTO tileset CDN
  - Wikipedia REST API
- **Riski:** Jos CDN kompromittoidaan, sovellus lataa mahdollisesti haitallista koodia
- **Suositus:**
  - Lisää `integrity`-attribuutti CDN-resursseille (Subresource Integrity / SRI)
  - Harkitse resurssien paikallisintegrointia (bundlaus, offline-tuki)

#### 6. Salasanan vaihto -dialogi ei validoi tarpeeksi
- **Sijainti:** `app.js`, rivit 473–486
- **Ongelma:** Uudelleenyritysyritykset rajoittavat, mutta ei ole rate-limiting-mekanismia
- **Riski:** Hyökkääjä voi brute-force-hyökätä salasanaa paikallisesti (vaikkakaan autentikaation puuttuessa se on epätärkeämpää)
- **Suositus:** Toteuta server-side -autentikaatio ja rate-limiting

---

### 🟡 Keskikokoiset ongelmat

#### 7. Content Security Policy (CSP) puuttuu
- **Ongelma:** Ei CSP-otsikoita, joten eval(), inline-skriptit ja ulkoiset skriptit eivät ole rajoitettuja
- **Riski:** Lisää XSS- ja code injection -riskiä
- **Suositus:** Lisää `Content-Security-Policy` -otsikko:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' unpkg.com; style-src 'self' fonts.googleapis.com; img-src 'self' data: https:; font-src fonts.gstatic.com; connect-src 'self' fi.wikipedia.org *.basemaps.cartocdn.com
  ```

#### 8. CORS-politiikka ei ole eksplisiitti
- **Ongelma:** Sovellus hakee dataa WikipediaAPI:sta ja CartoCDN:stä ilman CORS-validaatiota
- **Riski:** Man-in-the-middle -hyökkäys tai väärän datan injektio
- **Suositus:** Käytä HTTPS-yhteyttä (GitHub Pages tekee automaattisesti), ja tarkista vastauksien alkuperä

#### 9. Lokaalisäilytys ei ole salattu
- **Ongelma:** `localStorage` säilytetään selain-profiilin muistossa selvätekstissä
- **Riski:** Käytetyt puistot ja käyttäjän istunto ovat näkyvissä paikallisesti
- **Suositus:**
  - Harkitse `sessionStorage` sijaan `localStorage`:n (sulkeutuu istunnon lopussa)
  - Käytä IndexedDB kryptauksella (vaatii salauskirjastoa, esim. TweetNaCl.js)

#### 10. Ei versiotietoa riippuvuuksille
- **Sijainti:** Leaflet, Google Fonts, CartoCDN
- **Ongelma:** Versiot on ankkuroitu CDN-URL-osoitteisiin, mutta poistot eivät ole versionhallinnassa
- **Riski:** Vanhojen versioiden turvaaukkoja ei välttämättä korjata
- **Suositus:** Seuraa säännöllisesti CDN-riippuvuuksien päivityksiä

#### 11. Virheenhallinta ja lokitus puutteelliset
- **Sijainti:** `app.js`, esim. rivi 129 (`console.warn`)
- **Ongelma:** Virheet tulostetaan vain konsoliin, ei lähetetä palvelimelle
- **Riski:** Vaikeaa havaita turvaloukkauksia tai hyökkäyksiä
- **Suositus:** Toteuta server-side -virheenlokitus ja monitorointi

---

### 🟢 Pienet huomiot ja hyviä käytäntöjä

#### 12. Hyviä: HTML sanitisaatio on osittain kunnossa ✓
- `escapeHtml()` -funktio suojaa useimpien XSS-vektorien osalta
- Suositus: Varmista kaikkien käyttäjän näkemien kenttien sanitisaatio

#### 13. Hyviä: HTTPS GitHub Pages -osoitteessa ✓
- GitHub Pages pakottaa automaattisesti HTTPS:n, mikä suojaa transport-layer -tasolla

#### 14. Hyviä: Ei SQL-injektio-riskiä ✓
- Sovellus on staattinen eikä käytä tietokantoja

#### 15. Hyviä: Selaimen secu-attribuutit
- `localStorage` on eristetty origin-tasolla (CORS)
- Suositus: Lisää `HttpOnly` ja `Secure` -evästeiden merkinnät (kun käytät omia evästeitä)

---

## Suositeltavat korjaukset (prioriteetti)

| Prioriteetti | Ongelma | Toimenpide | Vaativa |
|---|---|---|---|
| **P0** | Kovakoodatut tunnukset | Poista demo-tunnukset tai siirrä vain dev-koodiin | 🔴 Korkea |
| **P0** | Palvelimen puolella autentikaatio | Toteuta oikea kirjautuminen | 🔴 Korkea |
| **P0** | Salasana selvätekstissä | Älä säilytä salasanoja selaimessa | 🔴 Korkea |
| **P1** | Content Security Policy | Lisää CSP-otsikko | 🟡 Keskitaso |
| **P1** | Subresource Integrity | Lisää SRI-attribuutit CDN-resursseille | 🟡 Keskitaso |
| **P2** | Lokitus ja monitorointi | Toteuta server-side -virheenlokitus | 🟡 Keskitaso |
| **P2** | Versiohallinta riippuvuuksille | Dokumentoi versiot package.json:issa (tai vastaavassa) | 🟢 Matala |

---

## Lisäsuositukset yleisesti

1. **Tietosuojaselosteet (Privacy Policy)**: Dokumentoi, mitä tietoja sovellus kerää (Wikipedia-kuvahaun leima-aikaarvot jne.)
2. **Vastuunoton kaavake (Disclaimer)**: Kerro, että demo on vain harjoitukseen, ei tuotantokäyttöön
3. **Säännöllisiä päivityksiä**: Monitoroi CDN-kirjastojen päivityksiä ja turvakorjauksia
4. **Penetraatiotestaus**: Harkitse ammattilaiselle tekemää tietoturvahyökkäystestiä isommassa versiossa
5. **OWASP Top 10**: Tarkista sovellus suhteessa OWASP:n nykyisiin parhaisiin käytäntöihin

---

## Johtopäätös

KarttaTesti2 on hyvin toteutettu staattinen verkkosovellus, mutta se sisältää useita tietoturvaongelmia, jotka olisi korjattava ennen tuotantokäyttöä. Suurin ongelma on puuttuva palvelimen puolella oleva autentikaatio ja salasanan tallennus selvätekstissä.

**Suositeltu toimenpide:** Sovellus soveltuu hyvin harjoituskäyttöön ja demoon, mutta ennen kuin sitä käytetään oikeilla käyttäjätiedoilla tai tärkeillä tiedoilla, on toteutettava nämä tietoturvakorjaukset.

---

**Tarkastuksen suorittaja:** GitHub Copilot  
**Tarkastuspäivä:** 3. heinäkuuta 2026
