# Kansallispuistot

Interaktiivinen kartta Suomen kansallispuistoista. Sovelluksella voi selata puistoja listalta tai kartalta, hakea ja suodattaa niitä, sekä kirjautuneena merkitä puistoja käydyiksi. Merkinnät tallentuvat selaimen `localStorage`-muistiin.

## Ominaisuudet

- **Kartta** – Leaflet-kartta Suomesta, jokainen kansallispuisto omana pisteenään. Piste on väriltään vihreä, jos puisto on merkitty käydyksi, ja harmaa muuten.
- **Puistolista** – sivupalkissa aakkosellinen lista kaikista puistoista, jossa näkyy maakunta ja käynti-tila.
- **Haku ja suodatus** – vapaatekstihaku nimellä/maakunnalla, sekä pikasuodattimet "Kaikki / Käydyt / Käymättä".
- **Puistokortti** – puistoa klikattaessa avautuu yksityiskohtakortti: kuva (haetaan automaattisesti Wikipedian kautta), kuvaus, perustamisvuosi, pinta-ala ja linkki luontoon.fi-sivulle.
- **Käynti-merkinnät** – kirjautunut käyttäjä voi merkitä puiston käydyksi/käymättömäksi. Tila tallentuu `localStorage`-muistiin, joten se säilyy selaimen sulkemisen jälkeenkin (samalla laitteella/selaimella).
- **Demo-kirjautuminen** – kevyt, vain selaimen puolella toimiva "kirjautuminen" ilman varsinaista backendia. Oletustunnukset:
  - käyttäjätunnus: `retkeilija`
  - salasana: `metsa2026`
  - salasanan voi vaihtaa kirjautuneena "Vaihda salasana" -toiminnolla (tallentuu myös `localStorage`-muistiin).
- **Teemat** – kolme väriteemaa: Raikas (vihreä/vaalea), Utua (harmaansininen) ja Ruska (lämmin/beige). Vaihtaa sekä värimaailman että karttapohjan.
- **Edistymispalkki** – yhteenveto käytyjen puistojen määrästä ja prosenttiosuudesta.
- **Responsiivisuus** – kapealla näytöllä sivupalkki muuttuu vetolaatikoksi (drawer), jonka saa auki yläpalkin valikkonapista.

## Teknologiat

Sovellus on täysin staattinen, ilman build-vaihetta tai palvelinta:

| Osa-alue | Teknologia |
|---|---|
| Rakenne | HTML5 |
| Tyylit | Vanilla CSS (CSS custom properties / muuttujat teemoja varten) |
| Logiikka | Vanilla JavaScript (ES2015+ luokka, ei frameworkeja) |
| Kartta | [Leaflet](https://leafletjs.com/) 1.9.4 (CDN: unpkg.com) |
| Karttapohjat | [CARTO basemaps](https://carto.com/basemaps) (light_all, light_nolabels, voyager) OpenStreetMap-datalla |
| Fontit | Google Fonts: Instrument Serif & Instrument Sans |
| Kuvahaku | Wikipedian REST-rajapinta (`fi.wikipedia.org/api/rest_v1/page/media-list/...`) |
| Tallennus | Selaimen `localStorage` (ei backendiä eikä tietokantaa) |
| Julkaisu | GitHub Pages, GitHub Actionsin kautta |

## Tiedostorakenne

```
.
├── index.html                      Sivun HTML-runko (sivupalkki, kartta, modaalit)
├── styles.css                      Kaikki tyylit, teemamuuttujat ja responsiivisuus
├── app.js                          Sovelluslogiikka: tila, kartta, haku/suodatus, kirjautuminen
├── parks.json                      Kansallispuistojen data (ks. Datamalli)
├── README.md                       Tämä dokumentti
└── .github/
    └── workflows/
        └── deploy-pages.yml        GitHub Actions -työnkulku, joka julkaisee sivun GitHub Pagesiin
```

Sovelluksessa ei ole erillistä build-askelta – `index.html` lataa `styles.css`:n ja `app.js`:n suoraan, ja `app.js` hakee `parks.json`-tiedoston `fetch`-kutsulla samasta kansiosta.

## Datamalli

`parks.json` on taulukko puisto-objekteja. Jokaisessa on samat kentät:

| Kenttä | Tyyppi | Kuvaus |
|---|---|---|
| `id` | string | Puiston tunniste (slug), käytetään mm. luontoon.fi-linkissä ja avaimena `localStorage`-tallennuksissa |
| `nimi` | string | Puiston nimi |
| `lat`, `lng` | number | Sijainti (WGS84-koordinaatit), kartan pistettä varten |
| `perustettu` | number | Perustamisvuosi |
| `pintaAla` | string | Pinta-ala valmiiksi muotoiltuna (esim. `"500 km²"`) |
| `maakunta` | string | Maakunta tai maakunnat (esim. `"Lappi / Pohjois-Pohjanmaa"`) |
| `kuvaus` | string | Lyhyt kuvausteksti puistokorttiin |
| `visited` | boolean | Oletusarvoinen käynti-tila, jos käyttäjällä ei vielä ole omaa `localStorage`-merkintää |
| `wiki` | string | Suomenkielisen Wikipedia-artikkelin nimi, jota käytetään kuvahaussa |

Esimerkki:

```json
{
  "id": "saaristomeri",
  "nimi": "Saaristomeri",
  "lat": 60.1,
  "lng": 21.75,
  "perustettu": 1983,
  "pintaAla": "500 km²",
  "maakunta": "Varsinais-Suomi",
  "kuvaus": "Ainutlaatuista saaristoluontoa tuhansine luotoineen ja saarineen. Osa Unescon biosfäärialuetta.",
  "visited": true,
  "wiki": "Saaristomeren kansallispuisto"
}
```

### `localStorage`-avaimet (selaimen puolella syntyvä tila)

| Avain | Sisältö |
|---|---|
| `kp_visited` | `{ [puistonId]: boolean }` – käyttäjän omat käynti-merkinnät, ohittaa `parks.json`:n `visited`-oletuksen |
| `kp_images` | `{ [puistonId]: kuvaUrl }` – välimuistiin haetut Wikipedia-kuvat |
| `kp_session` | läsnä, jos käyttäjä on "kirjautunut" demo-tunnuksella |
| `kp_password` | vaihdettu salasana, jos käyttäjä on vaihtanut sen oletuksesta |

## Julkaisu GitHub Pages -sivulle

Julkaisu tapahtuu automaattisesti **GitHub Actionsin** kautta aina kun `main`-haaraan pushataan. Työnkulku on tiedostossa [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

### Käyttöönotto (tehdään kerran)

1. Mene repositorion GitHubissa: **Settings → Pages**.
2. Kohdassa **Build and deployment → Source**, valitse **GitHub Actions** (ei "Deploy from a branch").
3. Varmista, että `.github/workflows/deploy-pages.yml` on mergetty `main`-haaraan.
4. Pushaa `main`-haaraan (tai käynnistä workflow käsin: **Actions**-välilehti → *Deploy to GitHub Pages* → **Run workflow**).
5. Kun ajo on valmis, sivu löytyy osoitteesta `https://<käyttäjätunnus>.github.io/<repositorion-nimi>/` (esim. `https://paanpe.github.io/KarttaTesti2/`). Osoite näkyy myös **Settings → Pages** -sivulla sekä workflown lopputuloksessa (`page_url`).

Jatkossa jokainen `main`-haaraan menevä push päivittää sivun automaattisesti – erillistä build-komentoa ei tarvita, koska sivusto on täysin staattinen.

## Miksi sivu ei aiemmin näkynyt GitHub Pagesissa?

Repositoriossa ei ollut lainkaan `.github/workflows`-kansiota eikä yhtään GitHub Actions -työnkulkua ennen tätä muutosta ("Actions"-välilehdellä oli 0 workflow'ta). Tämä tarkoittaa, että:

- **Mikään ei koskaan buildannut tai deployannut sivua** – GitHub Pages tarvitsee joko (a) perinteisen "Deploy from a branch" -asetuksen tietylle haaralle/kansiolle, tai (b) GitHub Actions -työnkulun, joka nimenomaisesti pakkaa sivuston ja ajaa `actions/deploy-pages`-toiminnon. Kumpaakaan ei ollut konfiguroitu.
- Vaikka repositoriossa on täysin toimiva staattinen sivusto (`index.html`, `styles.css`, `app.js`, `parks.json`), pelkkä tiedostojen olemassaolo repositoriossa ei riitä – GitHub Pages ei automaattisesti julkaise mitään ilman erikseen määriteltyä lähdettä.
- Lisäksi **Settings → Pages** -asetuksissa ei todennäköisesti ollut vielä valittu lähteeksi "GitHub Actions", joten vaikka workflow olisi ollutkin olemassa, sillä ei olisi ollut mihin deividä.

Tämän muutoksen mukana lisätty `.github/workflows/deploy-pages.yml` korjaa tämän: se määrittää varsinaisen julkaisuputken (`actions/configure-pages` → `actions/upload-pages-artifact` → `actions/deploy-pages`), joka ajetaan automaattisesti jokaisella `main`-haaraan tulevalla pushilla. Ainoa jäljellä oleva manuaalinen askel on yllä mainittu kertaluonteinen **Source: GitHub Actions** -valinta repositorion Pages-asetuksissa – GitHubin oikeudet eivät anna tätä tehdä automaattisesti API:n kautta.
