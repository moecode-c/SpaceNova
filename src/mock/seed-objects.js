/**
 * Catalog seed, Phase 1 fixture data.
 *
 * FIXTURE NOTICE, surfaced in the interface wherever this data is shown:
 * names and catalog numbers are used so the catalogue is recognisable, but all
 * orbital elements are generated locally (see src/engine/tle.js) and the
 * remaining metadata is placeholder. Nothing here is authoritative, and nothing
 * here is an observation. Phase 2 replaces this module with the general
 * perturbation data and catalogue metadata described in SRS B.3.
 *
 * Tuple order:
 *   name, noradId, intlDes, category, type, operator, country,
 *   launched, altitudeKm, inclinationDeg, eccentricity,
 *   standardMagnitude, massKg, rcsM2, bands
 */

export const OBJECT_SEED = [
  // --- Crewed stations and vehicles ---------------------------------------
  ['ISS (ZARYA)', 25544, '1998-067A', 'station', 'station', 'NASA / Roscosmos / ESA / JAXA / CSA', 'International', '1998-11-20', 420, 51.64, 0.00067, -1.8, 444615, 399.05, ['VHF', 'UHF', 'S', 'Ku']],
  ['CSS (TIANHE)', 48274, '2021-035A', 'station', 'station', 'CMSA', 'China', '2021-04-29', 385, 41.47, 0.00042, -0.8, 22600, 88.4, ['S', 'Ka']],
  ['PROGRESS MS-27', 59854, '2024-112A', 'crew', 'payload', 'Roscosmos', 'Russia', '2024-05-30', 418, 51.63, 0.00051, 2.6, 7290, 12.4, ['VHF', 'S']],
  ['CREW DRAGON ENDEAVOUR', 57712, '2023-131A', 'crew', 'payload', 'SpaceX / NASA', 'United States', '2023-08-26', 419, 51.64, 0.00048, 1.4, 12519, 18.6, ['S', 'Ku']],

  // --- Earth observation ---------------------------------------------------
  ['TERRA', 25994, '1999-068A', 'earth-observation', 'payload', 'NASA', 'United States', '1999-12-18', 705, 98.21, 0.00013, 3.2, 5190, 25.4, ['S', 'X']],
  ['AQUA', 27424, '2002-022A', 'earth-observation', 'payload', 'NASA', 'United States', '2002-05-04', 702, 98.19, 0.00015, 3.4, 2934, 20.1, ['S', 'X']],
  ['AURA', 28376, '2004-026A', 'earth-observation', 'payload', 'NASA', 'United States', '2004-07-15', 705, 98.22, 0.00014, 3.6, 2967, 18.3, ['S', 'X']],
  ['LANDSAT 9', 49260, '2021-088A', 'earth-observation', 'payload', 'NASA / USGS', 'United States', '2021-09-27', 705, 98.22, 0.00012, 3.8, 2711, 14.8, ['S', 'X']],
  ['LANDSAT 8', 39084, '2013-008A', 'earth-observation', 'payload', 'NASA / USGS', 'United States', '2013-02-11', 705, 98.21, 0.00013, 3.9, 2623, 14.2, ['S', 'X']],
  ['SENTINEL-2A', 40697, '2015-028A', 'earth-observation', 'payload', 'ESA / Copernicus', 'Europe', '2015-06-23', 786, 98.57, 0.00011, 4.1, 1140, 9.6, ['S', 'X']],
  ['SENTINEL-2B', 42063, '2017-013A', 'earth-observation', 'payload', 'ESA / Copernicus', 'Europe', '2017-03-07', 786, 98.56, 0.00012, 4.1, 1130, 9.4, ['S', 'X']],
  ['SENTINEL-1A', 39634, '2014-016A', 'earth-observation', 'payload', 'ESA / Copernicus', 'Europe', '2014-04-03', 693, 98.18, 0.00013, 4.0, 2300, 11.8, ['S', 'X', 'C']],
  ['ICESAT-2', 43613, '2018-070A', 'earth-observation', 'payload', 'NASA', 'United States', '2018-09-15', 496, 92.0, 0.00018, 4.3, 1514, 8.2, ['S', 'X']],
  ['JASON-3', 41240, '2016-002A', 'earth-observation', 'payload', 'NOAA / CNES / ESA', 'International', '2016-01-17', 1336, 66.04, 0.00009, 4.6, 553, 6.4, ['S']],
  ['SWOT', 54754, '2022-170A', 'earth-observation', 'payload', 'NASA / CNES', 'International', '2022-12-16', 891, 77.6, 0.0001, 4.4, 2200, 10.9, ['S', 'X', 'Ka']],
  ['PRISMA', 44072, '2019-013A', 'earth-observation', 'payload', 'ASI', 'Italy', '2019-03-22', 615, 97.84, 0.00014, 4.8, 879, 5.6, ['S', 'X']],

  // --- Meteorology ---------------------------------------------------------
  ['NOAA 19', 33591, '2009-005A', 'weather', 'payload', 'NOAA', 'United States', '2009-02-06', 870, 99.19, 0.00014, 3.5, 1440, 12.4, ['VHF', 'S', 'L']],
  ['NOAA 20', 43013, '2017-073A', 'weather', 'payload', 'NOAA', 'United States', '2017-11-18', 824, 98.74, 0.00012, 3.7, 2540, 15.1, ['S', 'X', 'L']],
  ['NOAA 21', 54234, '2022-150A', 'weather', 'payload', 'NOAA', 'United States', '2022-11-10', 824, 98.75, 0.00012, 3.7, 2540, 15.0, ['S', 'X', 'L']],
  ['SUOMI NPP', 37849, '2011-061A', 'weather', 'payload', 'NOAA / NASA', 'United States', '2011-10-28', 824, 98.74, 0.00013, 3.8, 2200, 13.6, ['S', 'X', 'L']],
  ['METOP-C', 43689, '2018-087A', 'weather', 'payload', 'EUMETSAT', 'Europe', '2018-11-07', 817, 98.7, 0.00012, 3.6, 4085, 18.2, ['VHF', 'S', 'L']],
  ['GOES-18', 51850, '2022-021A', 'weather', 'payload', 'NOAA', 'United States', '2022-03-01', 35786, 0.04, 0.00013, 6.8, 2857, 22.6, ['S', 'L', 'Ka']],
  ['METEOSAT-11', 40732, '2015-034A', 'weather', 'payload', 'EUMETSAT', 'Europe', '2015-07-15', 35790, 0.72, 0.00021, 7.1, 2040, 17.4, ['S', 'L']],
  ['FENGYUN-4B', 52192, '2021-054A', 'weather', 'payload', 'CMA', 'China', '2021-06-02', 35788, 0.38, 0.00018, 7.0, 5400, 24.1, ['S', 'L']],

  // --- Navigation ----------------------------------------------------------
  ['GPS BIIF-10', 41019, '2015-062A', 'navigation', 'payload', 'US Space Force', 'United States', '2015-10-31', 20180, 55.02, 0.00124, 5.9, 1630, 13.2, ['L']],
  ['GPS BIII-6', 55268, '2023-005A', 'navigation', 'payload', 'US Space Force', 'United States', '2023-01-18', 20190, 55.08, 0.00098, 5.8, 3880, 16.4, ['L']],
  ['GALILEO-26', 49809, '2021-116A', 'navigation', 'payload', 'ESA / EUSPA', 'Europe', '2021-12-05', 23222, 56.12, 0.00034, 6.1, 715, 8.8, ['L']],
  ['GALILEO-21', 43564, '2018-060A', 'navigation', 'payload', 'ESA / EUSPA', 'Europe', '2018-07-25', 23225, 55.98, 0.00041, 6.1, 715, 8.8, ['L']],
  ['GLONASS-K1 17L', 45358, '2020-018A', 'navigation', 'payload', 'Roscosmos', 'Russia', '2020-03-16', 19140, 64.81, 0.00112, 6.0, 935, 10.2, ['L']],
  ['BEIDOU-3 M24', 45807, '2020-040A', 'navigation', 'payload', 'CNSA', 'China', '2020-06-23', 21528, 55.14, 0.00076, 6.2, 1014, 11.6, ['L', 'S']],

  // --- Communications ------------------------------------------------------
  ['STARLINK-4217', 53012, '2022-074AC', 'communications', 'payload', 'SpaceX', 'United States', '2022-07-11', 547, 53.22, 0.00017, 5.2, 295, 5.1, ['Ku', 'Ka', 'E']],
  ['STARLINK-5109', 55401, '2023-014BK', 'communications', 'payload', 'SpaceX', 'United States', '2023-02-02', 542, 43.0, 0.00016, 5.3, 295, 5.1, ['Ku', 'Ka', 'E']],
  ['STARLINK-30088', 58221, '2023-178L', 'communications', 'payload', 'SpaceX', 'United States', '2023-11-22', 525, 43.0, 0.00015, 4.9, 800, 8.2, ['Ku', 'Ka', 'E']],
  ['ONEWEB-0412', 51078, '2022-002J', 'communications', 'payload', 'Eutelsat OneWeb', 'United Kingdom', '2022-01-10', 1198, 87.41, 0.00021, 6.4, 147, 3.4, ['Ku', 'Ka']],
  ['ONEWEB-0587', 54201, '2022-146H', 'communications', 'payload', 'Eutelsat OneWeb', 'United Kingdom', '2022-11-10', 1200, 87.42, 0.00019, 6.4, 147, 3.4, ['Ku', 'Ka']],
  ['IRIDIUM 133', 43249, '2018-030C', 'communications', 'payload', 'Iridium', 'United States', '2018-03-30', 780, 86.4, 0.00019, 5.6, 860, 7.8, ['L', 'Ka']],
  ['IRIDIUM 167', 43575, '2018-061E', 'communications', 'payload', 'Iridium', 'United States', '2018-07-25', 781, 86.39, 0.00018, 5.6, 860, 7.8, ['L', 'Ka']],
  ['INTELSAT 39', 44476, '2019-049B', 'communications', 'payload', 'Intelsat', 'Luxembourg', '2019-08-06', 35792, 0.04, 0.00016, 8.2, 6600, 26.4, ['C', 'Ku']],
  ['EUTELSAT 7C', 44330, '2019-038B', 'communications', 'payload', 'Eutelsat', 'France', '2019-06-20', 35788, 0.06, 0.00014, 8.4, 3400, 19.8, ['Ku']],
  ['NILESAT 301', 52778, '2022-068A', 'communications', 'payload', 'Nilesat', 'Egypt', '2022-06-08', 35786, 0.03, 0.00012, 8.6, 4100, 21.2, ['Ku', 'Ka']],
  ['INMARSAT-6 F1', 50319, '2021-124A', 'communications', 'payload', 'Inmarsat / Viasat', 'United Kingdom', '2021-12-22', 35791, 0.05, 0.00015, 8.3, 5470, 23.6, ['L', 'Ka']],
  ['ASTRA 1P', 60012, '2024-113A', 'communications', 'payload', 'SES', 'Luxembourg', '2024-06-20', 35789, 0.04, 0.00013, 8.5, 6000, 24.8, ['Ku']],

  // --- Science and astronomy ----------------------------------------------
  ['HST (HUBBLE)', 20580, '1990-037B', 'science', 'payload', 'NASA / ESA', 'International', '1990-04-24', 528, 28.47, 0.00026, 2.4, 11110, 85.6, ['S']],
  ['CHANDRA', 25867, '1999-040B', 'science', 'payload', 'NASA', 'United States', '1999-07-23', 112000, 28.5, 0.74, 9.4, 4790, 42.3, ['S']],
  ['FERMI GLAST', 33053, '2008-029A', 'science', 'payload', 'NASA', 'United States', '2008-06-11', 535, 25.58, 0.00119, 4.1, 4303, 22.4, ['S']],
  ['SWIFT', 28485, '2004-047A', 'science', 'payload', 'NASA / ASI / UKSA', 'International', '2004-11-20', 540, 20.56, 0.00124, 4.6, 1470, 11.2, ['S']],
  ['NUSTAR', 38358, '2012-031A', 'science', 'payload', 'NASA', 'United States', '2012-06-13', 600, 6.03, 0.00098, 5.4, 350, 5.8, ['S']],
  ['IXPE', 50172, '2021-121A', 'science', 'payload', 'NASA / ASI', 'International', '2021-12-09', 601, 0.23, 0.00112, 5.9, 325, 4.9, ['S']],
  ['TESS', 43435, '2018-038A', 'science', 'payload', 'NASA', 'United States', '2018-04-18', 108000, 37.0, 0.55, 9.8, 362, 6.2, ['Ka']],
  ['XMM-NEWTON', 25989, '1999-066A', 'science', 'payload', 'ESA', 'Europe', '1999-12-10', 72000, 68.5, 0.81, 9.1, 3764, 28.6, ['S']],

  // --- Technology and amateur ---------------------------------------------
  ['FUNCUBE-1 (AO-73)', 39444, '2013-066B', 'amateur', 'payload', 'AMSAT-UK', 'United Kingdom', '2013-11-21', 620, 97.72, 0.00078, 7.4, 1, 0.03, ['VHF', 'UHF']],
  ['SAUDISAT 1C (SO-50)', 27607, '2002-058C', 'amateur', 'payload', 'AMSAT / KACST', 'Saudi Arabia', '2002-12-20', 630, 64.56, 0.00812, 7.6, 12, 0.08, ['VHF', 'UHF']],
  ['RADFXSAT (FOX-1B)', 43017, '2017-073E', 'amateur', 'payload', 'AMSAT-NA', 'United States', '2017-11-18', 590, 97.71, 0.00164, 7.8, 1, 0.03, ['VHF', 'UHF']],
  ['DIWATA-2', 43678, '2018-084H', 'technology', 'payload', 'PHL-Microsat', 'Philippines', '2018-10-29', 613, 97.84, 0.00096, 7.2, 57, 0.6, ['UHF', 'S']],
  ['NANOFF-3', 57102, '2023-084AQ', 'technology', 'payload', 'Spire Global', 'United States', '2023-06-12', 525, 97.46, 0.00084, 7.9, 6, 0.09, ['UHF', 'S']],
  ['PROBA-V', 39159, '2013-021A', 'technology', 'payload', 'ESA', 'Europe', '2013-05-07', 820, 98.73, 0.00024, 6.8, 140, 1.8, ['S', 'X']],

  // --- Rocket bodies and debris -------------------------------------------
  ['FALCON 9 R/B', 53014, '2022-074AE', 'rocket-body', 'rocket-body', 'SpaceX', 'United States', '2022-07-11', 302, 53.21, 0.01204, 4.2, 4000, 24.6, []],
  ['CZ-5B R/B', 48275, '2021-035B', 'rocket-body', 'rocket-body', 'CASC', 'China', '2021-04-29', 214, 41.48, 0.01806, 3.4, 21600, 48.2, []],
  ['SL-16 R/B', 23088, '1994-023G', 'rocket-body', 'rocket-body', 'Roscosmos', 'Ukraine', '1994-04-05', 846, 71.01, 0.00142, 3.8, 9000, 32.4, []],
  ['DELTA 1 DEB', 11964, '1980-026E', 'debris', 'debris', 'NASA', 'United States', '1980-03-25', 1398, 99.14, 0.00682, 9.2, 12, 0.42, []],
  ['FENGYUN 1C DEB', 31256, '1999-025AQZ', 'debris', 'debris', 'CMA', 'China', '1999-05-10', 842, 98.62, 0.01841, 10.4, 3, 0.11, []],
  ['COSMOS 2251 DEB', 34428, '1993-036SK', 'debris', 'debris', 'Roscosmos', 'Russia', '1993-06-16', 782, 74.02, 0.00924, 10.8, 2, 0.08, []],
];

export const CATEGORY_LABELS = {
  station: 'Space station',
  crew: 'Crew and cargo',
  'earth-observation': 'Earth observation',
  weather: 'Meteorology',
  navigation: 'Navigation',
  communications: 'Communications',
  science: 'Science and astronomy',
  technology: 'Technology demonstration',
  amateur: 'Amateur radio',
  'rocket-body': 'Rocket body',
  debris: 'Debris',
};

export const COUNTRY_LABELS = [
  'International',
  'United States',
  'Europe',
  'China',
  'Russia',
  'United Kingdom',
  'France',
  'Italy',
  'Luxembourg',
  'Egypt',
  'Saudi Arabia',
  'Philippines',
  'Ukraine',
];
