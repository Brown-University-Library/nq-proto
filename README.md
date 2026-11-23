Hugo site, using content adapters to take Google Sheets of NQ contributors and their pseudonyms to create pages, and make those pages searchable.

## Technologies:
- Hugo
- lunr.js
- Leaflet

Design by Studio Rainwater.

## To-dos:
- automate spreadsheets &rarr; joined_data.json build
- document joined_data &rarr; markers.geojson
- make lunr.js into separate modules, document
- figure out why lunr is being weird about names (e.g., "mary" and "brooks" should produce results that aren't appearing)
- add undefined dates to all filters
- map results &rarr; filtered list page
- browser testing, visual testing, accessibility testing
- remove old Tabulator pages/code
- style homepage title
- deal with symbols in Pseuds
- map layout in mobile