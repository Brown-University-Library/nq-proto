# Brown Hugo Starter

A fork of [Hugo Starter Theme](https://github.com/ericmurphyxyz/hugo-starter-theme) with some helpful added defaults for Brown University Library defaults and common use cases.

# Custom shortcodes

## Mirador embed

To embed a [BDR](https://repository.library.brown.edu) item using Mirador:

{{< mirador "1234" >}}

where 1234 is the numeric value for a BDR PID, e.g., the item at https://repository.library.brown.edu/studio/item/bdr:89322/ would be rendered with {{< mirador "89322" >}}. Multiple Mirador embeds can be included in a given page.

## Panopto

To embed a [Panopto](https://repository.library.brown.edu) video:

{{< panopto "b753b793-c6f5-48da-991a-aad10151b9ce" >}}

The Panopto ID is _not_ the BDR PID. It is the alphanumeric string in a Panopto URL: e.g., https://brown.hosted.panopto.com/Panopto/Pages/Embed.aspx?id=b753b793-c6f5-48da-991a-aad10151b9ce. This URL can be found by opening the "Default" View of a video in the BDR.

## Tabulator embeds from Google Sheets
{{< tabulator "script" >}}

The "script" will be the ID of the Tabulator div, and the name of the javascript file (e.g., `/assets/js/script.js` &mdash; do not include `assets/js/` in your shortcode).

# Google Analytics

Set up a Google Analytics 4 property in the BUL account, and get the tag: `G-XXXXXXXXX`. In `hugo.toml`, add the following:

```
[services]
  [services.googleAnalytics]
    id = 'G-XXXXXXXXX'
    respectDoNotTrack = true
```

Replace the placeholder value. Analytics should work automatically.