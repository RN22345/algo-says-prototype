/* Tiny bridge between the browser app and the site pages. browser.js fills it in when it loads. */
export const nav = {
  redraw() {},             // draw the current page again
  go(site, page, arg) {},  // show a page of a site (opens or reuses its tab)
  reload(site) {}          // new feed items for a site
};
