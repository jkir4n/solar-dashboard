# Sky data notices

Third-party astronomical data imported by the source renderer; the next approved build will bundle it into `dist/solar-dashboard.js`. Kept in the repository
because the HACS bundle must not fetch star data at runtime.

## Star catalogue

| Field | Value |
|---|---|
| File in this repository | `src/scene/star-catalogue.js` (naming drift: the plan calls this `src/data/stars.js`) |
| Primary source | HYG Database v4.1, David Nash / Astronexus |
| Source URL | https://github.com/astronexus/HYG-Database/blob/main/hyg/CURRENT/hygdata_v41.csv |
| Upstream description | HYG combines Hipparcos, Yale Bright Star and Gliese catalogues |
| License of this subset | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ |
| Rows bundled | 925 |
| Selection rule | Visual magnitude <= 4.5 (stated in the file header; confirmed: min -1.44, max 4.50) |
| Epoch | J2000.0 |
| RA unit | Hours, decimal (0 <= RA < 24) |
| Dec unit | Degrees, decimal (-83.67 to +89.26 in this subset) |
| Extra column | B-V colour index |

### Attribution

The upstream HYG database is distributed under CC BY-SA 4.0. A subset of a CC BY-SA 4.0
database is generally treated as a derivative and carries the same licence. The attribution
line is preserved verbatim at the top of `src/scene/star-catalogue.js`:

```
// HYG v4.1, David Nash / Astronexus. Bright-star subset (magnitude <= 4.5).
// Modified: retained name, J2000 RA hours, declination degrees, magnitude, B-V color.
// This data subset is CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
```

**Open licensing question for release review:** bundling CC BY-SA 4.0 data inside a
distributed plugin makes the *data* share-alike. The repository itself is MIT. This
combination is workable only while the licence notice travels with the bundle (this file
plus the header). It must be re-checked before the first public release that ships the
catalogue, and the notice must appear in README or the release notes.

### Mapping from the original database

1. Upstream rows were filtered to visual magnitude <= 4.5.
2. Columns retained: name, J2000 RA, J2000 declination, visual magnitude, B-V.
3. RA retains the upstream hours unit. The consumer converts to degrees: `raDeg = raHours * 15` (see `src/scene/sky-state.js`).
4. Names retain the upstream HYG naming convention, which mixes proper names, Bayer
   designations and Flamsteed designations, e.g. `Alpheratz`, `31Del And`, `30    Psc`.

### Known data caveats (do not silently "clean up")

- Two rows have an empty name string: `["",5.277926,46.000842,0.96,0]` (Capella's
  neighbour position) and `["",17.172783,-15.726921,3.4,0]` (duplicates Sabik). They render
  as unnamed points. A renderer must tolerate an empty label.
- The subset retains upstream multiple-system/component rows: `Castor B`, `Alula Australis`, `29Gam Vir`, `79Zet UMa`, plus the two unnamed rows.
  All 925 rows came from the magnitude filter; none were manually appended in this project.
- Runtime identifiers are derived from the catalogue RA, declination and magnitude, so ordering changes do not renumber stars.
- Proper motion is not applied. Positions are J2000 catalogue positions; the apparent
  position for the current date comes from the equatorial-to-horizontal rotation matrix in
  `sky-state.js`, which handles precession/nutation of the frame but not each star's own
  motion. This limits precision over long timespans; this catalogue is intended for present-day visual simulation.

## Projection and frame conventions

- Input frame: J2000 equatorial, right ascension in hours, declination in degrees.
- Conversion to scene coordinates (`src/scene/sky-state.js`):
  `Rotation_EQJ_HOR(date, observer)` then `RotateVector`, then a component map
  `[-v.y, v.z, -v.x]`.
- Scene axes, shared with the architecture and the sun/moon: **north = -Z, east = +X,
  up = +Y**. Azimuth is measured from true north, increasing clockwise.
- The Milky Way great circle is oriented from the J2000 galactic north pole at
  RA 12.8594779 h, Dec +27.12825 deg, rotated into the same horizontal frame, so the whole
  band is oriented in celestial space rather than being pinned to one screen point.
- Stars are drawn from catalogue positions, never from generated random coordinates. The
  retired `src/weather-fx.js` random star field is not a valid source for this.

## Planetary and solar data

No ephemeris tables are bundled. Sun, Moon and planet positions are computed at runtime by
`astronomy-engine` (MIT licence) and, for the scenery's sky snapshot, by the same library
through `src/scene/sky-state.js`. Reference fixtures for validating those positions come
from JPL Horizons and USNO and live in `test/fixtures/astronomy.json` with their own
retrieval notes.
